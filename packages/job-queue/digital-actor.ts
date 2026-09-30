import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { JOB_STAGES, digitalActorSchema, type JobStage } from "@/packages/digital-actor-schema";
import type { ModelRegistry } from "@/services/identity/contracts";

/** Worker-only PostgreSQL queue. Lease tokens fence expired workers. */
export async function processNextActorJob(pool: Pool, registry: ModelRegistry, timeoutMs = 120_000) {
  const token = randomUUID();
  const { rows } = await pool.query(`update public.digital_actor_jobs set status='running', attempts=attempts+1,
    lease_token=$1, locked_until=now()+($2 * interval '1 millisecond'), updated_at=now()
    where id=(select id from public.digital_actor_jobs where attempts < max_attempts and
      (status in ('queued','retrying') or (status='running' and locked_until < now()))
      order by created_at for update skip locked limit 1) returning *`, [token, timeoutMs + 30_000]);
  const job = rows[0];
  if (!job) return false;
  try {
    const provider = registry.resolve(job.stage as JobStage);
    const { rows: actors } = await pool.query("select identity from public.digital_actors where id=$1 and user_id=$2 and version=$3", [job.actor_id, job.user_id, job.actor_version]);
    if (!actors[0]) throw new Error("Actor version unavailable");
    const signal = AbortSignal.timeout(timeoutMs);
    const actor = digitalActorSchema.parse(actors[0].identity);
    const updated = digitalActorSchema.parse(await Promise.race([
      provider.run(structuredClone(actor), signal),
      new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new Error("Provider timeout")), { once: true })),
    ]));
    if (updated.id !== actor.id || updated.userId !== actor.userId || updated.version !== actor.version) throw new Error("Provider changed actor ownership or version");
    const connection = await pool.connect();
    try {
      await connection.query("begin");
      const lease = await connection.query("select id from public.digital_actor_jobs where id=$1 and lease_token=$2 and status='running' and locked_until > now() for update", [job.id, token]);
      if (!lease.rowCount) throw new Error("Lease expired");
      const saved = await connection.query("update public.digital_actors set identity=$1, status=$2, updated_at=now() where id=$3 and user_id=$4 and version=$5 returning id", [updated, updated.status, actor.id, actor.userId, actor.version]);
      if (!saved.rowCount) throw new Error("Actor deleted or rebuilt");
      await connection.query("update public.digital_actor_jobs set status='completed', locked_until=null where id=$1 and lease_token=$2", [job.id, token]);
      const next = JOB_STAGES[JOB_STAGES.indexOf(job.stage) + 1];
      if (next) await connection.query("insert into public.digital_actor_jobs(actor_id,user_id,actor_version,stage) values($1,$2,$3,$4) on conflict do nothing", [actor.id, actor.userId, actor.version, next]);
      await connection.query("commit");
    } catch (error) { await connection.query("rollback"); throw error; }
    finally { connection.release(); }
  } catch {
    await pool.query("update public.digital_actor_jobs set status=case when attempts>=max_attempts then 'failed' else 'retrying' end, last_error='Stage failed; check worker diagnostics', locked_until=null where id=$1 and lease_token=$2 and status='running'", [job.id, token]);
  }
  return true;
}
