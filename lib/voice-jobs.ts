import { createAdminClient } from "./supabase/admin";

/**
 * Thin wrapper around the `voice_jobs` queue defined in migration 010.
 *
 * The queue is *durable*: each cloning step writes a row, and a worker
 * picks it up via the atomic `lease_voice_job()` RPC. If the worker
 * crashes mid-job the lease expires and another worker can retry,
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

export async function enqueueJob(params: {
  userId: string;
  type: VoiceJobType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  maxAttempts?: number;
}): Promise<VoiceJob> {
  const admin = createAdminClient();
  const insert = {
    user_id: params.userId,
    type: params.type,
    payload: params.payload,
    idempotency_key: params.idempotencyKey ?? null,
    max_attempts: params.maxAttempts ?? 3,
    status: "queued" as const,
  };

  const { data, error } = await admin
    .from("voice_jobs")
    .insert(insert)
    .select()
    .single();

  if (error) {
    // Idempotency-key collision => return the existing row.
    if (params.idempotencyKey && error.code === "23505") {
      const { data: existing } = await admin
        .from("voice_jobs")
        .select("*")
        .eq("idempotency_key", params.idempotencyKey)
        .single();
      if (existing) return existing as VoiceJob;
    }
    throw error;
  }

  return data as VoiceJob;
}

export async function leaseNextJob(params: {
  workerId: string;
  leaseSeconds?: number;
}): Promise<VoiceJob | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("lease_voice_job", {
    p_worker_id: params.workerId,
    p_lease_seconds: params.leaseSeconds ?? 300,
  });
  if (error) throw error;
  const rows = data as VoiceJob[] | null;
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function completeJob(
  jobId: string,
  result: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("voice_jobs")
    .update({
      status: "succeeded",
      result,
      completed_at: new Date().toISOString(),
      locked_until: null,
    })
    .eq("id", jobId);
}

export async function failJob(
  jobId: string,
  error: string,
  options?: { permanent?: boolean }
): Promise<void> {
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("voice_jobs")
    .select("attempts, max_attempts")
    .eq("id", jobId)
    .single();

  const reachedMax =
    !!options?.permanent ||
    (job ? job.attempts >= job.max_attempts : true);

  await admin
    .from("voice_jobs")
    .update({
      status: reachedMax ? "failed" : "queued",
      last_error: error,
      locked_until: null,
      completed_at: reachedMax ? new Date().toISOString() : null,
    })
    .eq("id", jobId);
}

export async function cancelJob(jobId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("voice_jobs")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
      locked_until: null,
    })
    .eq("id", jobId)
    .eq("user_id", userId)
    .in("status", ["queued", "running"])
    .select("id");
  if (error) return false;
  return (data?.length ?? 0) > 0;
}
