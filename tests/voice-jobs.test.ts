import { describe, it, expect, vi, beforeEach } from "vitest";

type Job = {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  worker_id: string | null;
  result: Record<string, unknown> | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const store = new Map<string, Job>();
const updates: Array<{ id: string; patch: Partial<Job> }> = [];

function asJob(partial: Partial<Job>): Job {
  return {
    id: partial.id ?? `job_${store.size + 1}`,
    user_id: partial.user_id ?? "u1",
    type: partial.type ?? "voice_clone",
    payload: partial.payload ?? {},
    status: partial.status ?? "queued",
    attempts: partial.attempts ?? 0,
    max_attempts: partial.max_attempts ?? 3,
    last_error: partial.last_error ?? null,
    worker_id: partial.worker_id ?? null,
    result: partial.result ?? null,
    idempotency_key: partial.idempotency_key ?? null,
    created_at: partial.created_at ?? new Date().toISOString(),
    updated_at: partial.updated_at ?? new Date().toISOString(),
    completed_at: partial.completed_at ?? null,
  };
}

vi.mock("../lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: () => ({
      insert: (row: Partial<Job>) => ({
        select: () => ({
          single: () => {
            if (
              row.idempotency_key &&
              Array.from(store.values()).some(
                (j) => j.idempotency_key === row.idempotency_key
              )
            ) {
              return Promise.resolve({
                data: null,
                error: { code: "23505", message: "duplicate" },
              });
            }
            const job = asJob(row);
            store.set(job.id, job);
            return Promise.resolve({ data: job, error: null });
          },
        }),
      }),
      select: () => {
        const filters: { col: string; val: unknown }[] = [];
        const builder = {
          eq(col: string, val: unknown) {
            filters.push({ col, val });
            return builder;
          },
          in() {
            return builder;
          },
          single() {
            const match = Array.from(store.values()).find((j) =>
              filters.every((f) => (j as any)[f.col] === f.val)
            );
            return Promise.resolve({ data: match ?? null, error: null });
          },
        };
        return builder;
      },
      update: (patch: Partial<Job>) => ({
        eq(_col: string, val: string) {
          updates.push({ id: val, patch });
          const existing = store.get(val);
          if (existing) store.set(val, { ...existing, ...patch });
          return {
            eq() {
              return {
                in() {
                  return {
                    select() {
                      return Promise.resolve({ data: [{ id: val }], error: null });
                    },
                  };
                },
              };
            },
          };
        },
      }),
    }),
  }),
}));

import { enqueueJob, completeJob, failJob, cancelJob } from "../lib/voice-jobs";

beforeEach(() => {
  store.clear();
  updates.length = 0;
});

describe("enqueueJob", () => {
  it("inserts a new job and returns it", async () => {
    const job = await enqueueJob({
      userId: "u1",
      type: "voice_clone",
      payload: { voiceId: "v1" },
    });
    expect(job.user_id).toBe("u1");
    expect(job.type).toBe("voice_clone");
    expect(store.size).toBe(1);
  });

  it("returns the existing job when idempotency key collides", async () => {
    await enqueueJob({
      userId: "u1",
      type: "voice_clone",
      payload: { voiceId: "v1" },
      idempotencyKey: "k1",
    });
    const second = await enqueueJob({
      userId: "u1",
      type: "voice_clone",
      payload: { voiceId: "v1" },
      idempotencyKey: "k1",
    });
    expect(store.size).toBe(1);
    expect(second.idempotency_key).toBe("k1");
  });
});

describe("completeJob", () => {
  it("marks the job succeeded with a result", async () => {
    const job = await enqueueJob({
      userId: "u1",
      type: "voice_clone",
      payload: {},
    });
    await completeJob(job.id, { elevenlabsVoiceId: "el_1" });
    const patch = updates.find((u) => u.id === job.id);
    expect(patch).toBeDefined();
    expect(patch!.patch.status).toBe("succeeded");
    expect(patch!.patch.result).toEqual({ elevenlabsVoiceId: "el_1" });
  });
});

describe("failJob", () => {
  it("re-queues until attempts reach max", async () => {
    const job = await enqueueJob({
      userId: "u1",
      type: "voice_clone",
      payload: {},
    });
    // Bump attempts to simulate the second try
    store.set(job.id, { ...store.get(job.id)!, attempts: 1, max_attempts: 3 });
    await failJob(job.id, "transient");
    expect(updates[0].patch.status).toBe("queued");
  });

  it("marks permanently failed when attempts >= max", async () => {
    const job = await enqueueJob({
      userId: "u1",
      type: "voice_clone",
      payload: {},
    });
    store.set(job.id, { ...store.get(job.id)!, attempts: 3, max_attempts: 3 });
    await failJob(job.id, "fatal");
    expect(updates[0].patch.status).toBe("failed");
  });
});

describe("cancelJob", () => {
  it("returns true when an active job is cancelled", async () => {
    const job = await enqueueJob({
      userId: "u1",
      type: "voice_clone",
      payload: {},
    });
    const result = await cancelJob(job.id, "u1");
    expect(result).toBe(true);
  });
});
