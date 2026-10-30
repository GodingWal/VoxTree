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
/** Rows the mocked lease_voice_job() SQL function returns (snake_case). */
let leasedRows: Array<Record<string, unknown>> = [];

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

// Phase 4: lib/voice-jobs runs on Drizzle (lib/db). This mock keeps the
// same in-memory store behind the Drizzle chain surface, translating
// between the store's snake_case rows and Drizzle's camelCase rows.
// Recorded update patches stay in the Drizzle (camelCase) shape the lib
// now sends — the assertions below only inspect `status` and `result`,
// whose keys are unchanged.
type CamelJob = {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  workerId: string | null;
  result: Record<string, unknown> | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  lockedUntil: Date | null;
};

function toCamel(j: Job): CamelJob {
  return {
    id: j.id,
    userId: j.user_id,
    type: j.type,
    payload: j.payload,
    status: j.status,
    attempts: j.attempts,
    maxAttempts: j.max_attempts,
    lastError: j.last_error,
    workerId: j.worker_id,
    result: j.result,
    idempotencyKey: j.idempotency_key,
    createdAt: new Date(j.created_at),
    updatedAt: new Date(j.updated_at),
    completedAt: j.completed_at ? new Date(j.completed_at) : null,
    lockedUntil: null,
  };
}

/** Positional params bound in a Drizzle SQL condition, in order. Only
 *  descends through SQL queryChunks — Columns hold circular table refs. */
function sqlParams(cond: unknown): unknown[] {
  const out: unknown[] = [];
  const walk = (node: unknown, depth: number): void => {
    if (!node || typeof node !== "object" || depth > 8) return;
    if ((node as object).constructor?.name === "Param") {
      out.push((node as { value: unknown }).value);
      return;
    }
    const chunks = (node as { queryChunks?: unknown[] }).queryChunks;
    if (Array.isArray(chunks)) {
      for (const c of chunks) walk(c, depth + 1);
    }
  };
  walk(cond, 0);
  return out;
}

function applyPatch(id: string, patch: Record<string, unknown>) {
  updates.push({ id, patch: patch as Partial<Job> });
  const existing = store.get(id);
  if (!existing) return;
  const merged: Job = { ...existing };
  if (patch.status !== undefined) merged.status = patch.status as string;
  if (patch.result !== undefined) merged.result = patch.result as Job["result"];
  if (patch.lastError !== undefined) merged.last_error = patch.lastError as string | null;
  if (patch.completedAt !== undefined) {
    merged.completed_at =
      patch.completedAt instanceof Date
        ? patch.completedAt.toISOString()
        : (patch.completedAt as string | null);
  }
  store.set(id, merged);
}

vi.mock("../lib/db", () => ({
  db: {
    insert: () => ({
      values: (v: {
        userId: string;
        type: string;
        payload: Record<string, unknown>;
        idempotencyKey?: string | null;
        maxAttempts?: number;
        status?: string;
      }) => ({
        returning: () => {
          if (
            v.idempotencyKey &&
            Array.from(store.values()).some(
              (j) => j.idempotency_key === v.idempotencyKey
            )
          ) {
            // node-postgres surfaces unique violations as a thrown
            // error with code 23505 — lib/voice-jobs keys off that.
            return Promise.reject(
              Object.assign(new Error("duplicate"), { code: "23505" })
            );
          }
          const job = asJob({
            user_id: v.userId,
            type: v.type,
            payload: v.payload,
            idempotency_key: v.idempotencyKey ?? null,
            max_attempts: v.maxAttempts ?? 3,
            status: v.status ?? "queued",
          });
          store.set(job.id, job);
          return Promise.resolve([toCamel(job)]);
        },
      }),
    }),
    select: () => {
      let params: unknown[] = [];
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = (cond: unknown) => {
        params = sqlParams(cond);
        return chain;
      };
      chain.limit = () => chain;
      chain.then = (res: (v: unknown) => void, rej: (e: unknown) => void) => {
        const key = params[0];
        const match = Array.from(store.values()).find(
          (j) => j.id === key || j.idempotency_key === key
        );
        return Promise.resolve(match ? [toCamel(match)] : []).then(res, rej);
      };
      return chain;
    },
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        let params: unknown[] = [];
        const chain: Record<string, unknown> = {};
        chain.where = (cond: unknown) => {
          params = sqlParams(cond);
          return chain;
        };
        chain.returning = () => {
          // cancelJob: params are [jobId, userId, ...statuses]; the
          // update only lands for an owned, still-active job.
          const [jobId, userId] = params as [string, string];
          const job = store.get(jobId);
          if (job && job.user_id === userId && (job.status === "queued" || job.status === "running")) {
            applyPatch(jobId, patch);
            return Promise.resolve([{ id: jobId }]);
          }
          return Promise.resolve([]);
        };
        chain.then = (res: (v: unknown) => void, rej: (e: unknown) => void) => {
          applyPatch(params[0] as string, patch);
          return Promise.resolve([]).then(res, rej);
        };
        return chain;
      },
    }),
    execute: () => Promise.resolve({ rows: leasedRows }),
  },
}));

import { enqueueJob, completeJob, failJob, cancelJob, leaseNextJob } from "../lib/voice-jobs";

beforeEach(() => {
  store.clear();
  updates.length = 0;
  leasedRows = [];
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

  it("defaults max_attempts to 3 when maxAttempts is not given", async () => {
    const job = await enqueueJob({
      userId: "u1",
      type: "clip_generate",
      payload: { voiceId: "v1" },
    });
    expect(job.max_attempts).toBe(3);
  });

  it("preserves an explicit maxAttempts (sample-dub jobs pass 10)", async () => {
    const job = await enqueueJob({
      userId: "u1",
      type: "clip_generate",
      payload: { voiceId: "v1", source: "voice_create_sample_dub" },
      idempotencyKey: "sample-dub-v1",
      maxAttempts: 10,
    });
    expect(job.max_attempts).toBe(10);
    expect(store.get(job.id)!.max_attempts).toBe(10);
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
    await completeJob(job.id, { providerVoiceId: "cb_1" });
    const patch = updates.find((u) => u.id === job.id);
    expect(patch).toBeDefined();
    expect(patch!.patch.status).toBe("succeeded");
    expect(patch!.patch.result).toEqual({ providerVoiceId: "cb_1" });
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

  it("still re-queues at the old default of 3 attempts when max is 10 (slow-clone sample dub)", async () => {
    const job = await enqueueJob({
      userId: "u1",
      type: "clip_generate",
      payload: { voiceId: "v1", source: "voice_create_sample_dub" },
      maxAttempts: 10,
    });
    // Third lease of a not-yet-cloned voice: with max_attempts 3 this
    // failure would be permanent; with 10 the job must re-queue.
    store.set(job.id, { ...store.get(job.id)!, attempts: 3, max_attempts: 10 });
    await failJob(job.id, "Voice v1 has no provider voice id yet (not cloned)");
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

describe("leaseNextJob", () => {
  it("returns null when the queue is empty", async () => {
    leasedRows = [];
    await expect(leaseNextJob({ workerId: "w1" })).resolves.toBeNull();
  });

  it("maps the leased snake_case row to a VoiceJob", async () => {
    const created = new Date("2026-10-24T00:00:00.000Z");
    leasedRows = [
      {
        id: "job_42",
        user_id: "u9",
        type: "clip_generate",
        payload: { text: "hello", voiceId: "v1" },
        status: "running",
        attempts: 1,
        max_attempts: 3,
        last_error: null,
        worker_id: "w1",
        result: null,
        idempotency_key: "k42",
        created_at: created,
        updated_at: created,
        completed_at: null,
      },
    ];
    const job = await leaseNextJob({ workerId: "w1", leaseSeconds: 60 });
    expect(job).not.toBeNull();
    expect(job!.id).toBe("job_42");
    expect(job!.user_id).toBe("u9");
    expect(job!.type).toBe("clip_generate");
    expect(job!.payload).toEqual({ text: "hello", voiceId: "v1" });
    expect(job!.status).toBe("running");
    expect(job!.attempts).toBe(1);
    expect(job!.max_attempts).toBe(3);
    expect(job!.worker_id).toBe("w1");
    expect(job!.idempotency_key).toBe("k42");
    expect(job!.created_at).toBe("2026-10-24T00:00:00.000Z");
    expect(job!.completed_at).toBeNull();
  });
});
