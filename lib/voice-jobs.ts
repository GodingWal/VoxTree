import { and, eq, inArray, sql } from "drizzle-orm";

import { jobOwnedBy } from "./authz";
import { db } from "./db";
import { voiceJobs } from "./db/schema";

/**
 * Thin wrapper around the `voice_jobs` queue defined in migration 010.
 *
 * The queue is *durable*: each cloning step writes a row, and a worker
 * picks it up via the atomic `lease_voice_job()` SQL function. If the
 * worker crashes mid-job the lease expires and another worker can retry,
 * up to `max_attempts`.
 *
 * Use `enqueueJob(... idempotencyKey)` to make retries safe — the same
 * key collides on the unique index and returns the existing row.
 */

export type VoiceJobType =
  | "voice_clone"
  | "singing_train"
  | "clip_generate"
  | "talking_video"
  | "lora_train";

export interface VoiceJob {
  id: string;
  user_id: string;
  type: VoiceJobType;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  worker_id: string | null;
  result: Record<string, unknown> | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

type VoiceJobRow = typeof voiceJobs.$inferSelect;

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toVoiceJob(row: VoiceJobRow): VoiceJob {
  return {
    id: row.id,
    user_id: row.userId,
    type: row.type as VoiceJobType,
    payload: row.payload,
    status: row.status as VoiceJob["status"],
    attempts: row.attempts,
    max_attempts: row.maxAttempts,
    last_error: row.lastError,
    worker_id: row.workerId,
    result: row.result,
    idempotency_key: row.idempotencyKey,
    created_at: iso(row.createdAt) ?? "",
    updated_at: iso(row.updatedAt) ?? "",
    completed_at: iso(row.completedAt),
  };
}

/** Map a raw pg row (snake_case, from the lease_voice_job SQL function). */
function rawToVoiceJob(row: Record<string, unknown>): VoiceJob {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    type: row.type as VoiceJobType,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    status: row.status as VoiceJob["status"],
    attempts: row.attempts as number,
    max_attempts: row.max_attempts as number,
    last_error: (row.last_error as string | null) ?? null,
    worker_id: (row.worker_id as string | null) ?? null,
    result: (row.result as Record<string, unknown> | null) ?? null,
    idempotency_key: (row.idempotency_key as string | null) ?? null,
    created_at: iso(row.created_at as Date | string) ?? "",
    updated_at: iso(row.updated_at as Date | string) ?? "",
    completed_at: iso(row.completed_at as Date | string | null),
  };
}

export async function enqueueJob(params: {
  userId: string;
  type: VoiceJobType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  maxAttempts?: number;
}): Promise<VoiceJob> {
  try {
    const [row] = await db
      .insert(voiceJobs)
      .values({
        userId: params.userId,
        type: params.type,
        payload: params.payload,
        idempotencyKey: params.idempotencyKey ?? null,
        maxAttempts: params.maxAttempts ?? 3,
        status: "queued",
      })
      .returning();
    return toVoiceJob(row);
  } catch (error) {
    // Idempotency-key collision => return the existing row.
    if (
      params.idempotencyKey &&
      (error as { code?: string })?.code === "23505"
    ) {
      const [existing] = await db
        .select()
        .from(voiceJobs)
        .where(eq(voiceJobs.idempotencyKey, params.idempotencyKey))
        .limit(1);
      if (existing) return toVoiceJob(existing);
    }
    throw error;
  }
}

export async function leaseNextJob(params: {
  workerId: string;
  leaseSeconds?: number;
}): Promise<VoiceJob | null> {
  const result = await db.execute(
    sql`select * from lease_voice_job(${params.workerId}, ${params.leaseSeconds ?? 300})`
  );
  const rows = result.rows as Array<Record<string, unknown>>;
  return rows.length > 0 ? rawToVoiceJob(rows[0]) : null;
}

export async function completeJob(
  jobId: string,
  result: Record<string, unknown>
): Promise<void> {
  await db
    .update(voiceJobs)
    .set({
      status: "succeeded",
      result,
      completedAt: new Date(),
      lockedUntil: null,
    })
    .where(eq(voiceJobs.id, jobId));
}

export async function failJob(
  jobId: string,
  error: string,
  options?: { permanent?: boolean }
): Promise<void> {
  const [job] = await db
    .select({ attempts: voiceJobs.attempts, maxAttempts: voiceJobs.maxAttempts })
    .from(voiceJobs)
    .where(eq(voiceJobs.id, jobId))
    .limit(1);

  const reachedMax =
    !!options?.permanent ||
    (job ? job.attempts >= job.maxAttempts : true);

  await db
    .update(voiceJobs)
    .set({
      status: reachedMax ? "failed" : "queued",
      lastError: error,
      lockedUntil: null,
      completedAt: reachedMax ? new Date() : null,
    })
    .where(eq(voiceJobs.id, jobId));
}

export async function cancelJob(jobId: string, userId: string): Promise<boolean> {
  try {
    const rows = await db
      .update(voiceJobs)
      .set({
        status: "cancelled",
        completedAt: new Date(),
        lockedUntil: null,
      })
      .where(
        and(
          eq(voiceJobs.id, jobId),
          jobOwnedBy(userId),
          inArray(voiceJobs.status, ["queued", "running"])
        )
      )
      .returning({ id: voiceJobs.id });
    return rows.length > 0;
  } catch {
    return false;
  }
}
