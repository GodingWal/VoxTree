import { describe, it, expect, vi, beforeEach } from "vitest";

// The queue plumbing is mocked: processOneJob must lease via
// lib/voice-jobs, dispatch via the injected handlers, and settle the
// job with completeJob/failJob. The DB and the Chatterbox provider are
// never touched in these tests.
const leaseNextJob = vi.fn();
const completeJob = vi.fn();
const failJob = vi.fn();

vi.mock("../lib/voice-jobs", () => ({
  leaseNextJob: (...a: unknown[]) => leaseNextJob(...a),
  completeJob: (...a: unknown[]) => completeJob(...a),
  failJob: (...a: unknown[]) => failJob(...a),
}));

import {
  processOneJob,
  processVoiceJob,
  runVoiceWorker,
  PermanentJobError,
  type VoiceJobHandlers,
} from "../lib/voice-worker";
import type { VoiceJob } from "../lib/voice-jobs";

function makeJob(partial: Partial<VoiceJob> = {}): VoiceJob {
  return {
    id: "job_1",
    user_id: "u1",
    type: "clip_generate",
    payload: {},
    status: "running",
    attempts: 1,
    max_attempts: 3,
    last_error: null,
    worker_id: "w-test",
    result: null,
    idempotency_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
    ...partial,
  };
}

function makeHandlers(): VoiceJobHandlers {
  return {
    resolveProviderVoiceId: vi.fn(async () => "cb_voice_1"),
    generateSpeech: vi.fn(async () => Buffer.from("wav-bytes")),
    cloneVoice: vi.fn(async () => "cb_clone_1"),
    saveAudio: vi.fn(async (job: VoiceJob) => ({
      audioUrl: `/uploads/voice-jobs/${job.id}.wav`,
      storageKey: `voice-jobs/${job.id}.wav`,
    })),
  };
}

const deps = () => ({
  leaseNextJob,
  completeJob,
  failJob,
  handlers: makeHandlers(),
});

beforeEach(() => {
  vi.clearAllMocks();
  completeJob.mockResolvedValue(undefined);
  failJob.mockResolvedValue(undefined);
});

describe("processOneJob", () => {
  it("returns 'empty' and settles nothing when the queue is empty", async () => {
    leaseNextJob.mockResolvedValue(null);
    await expect(processOneJob("w-test", deps())).resolves.toBe("empty");
    expect(completeJob).not.toHaveBeenCalled();
    expect(failJob).not.toHaveBeenCalled();
  });

  it("leases with the worker id and completes a clip_generate job", async () => {
    const d = deps();
    leaseNextJob.mockResolvedValue(
      makeJob({ payload: { voiceId: "v1", text: "Once upon a time" } })
    );
    await expect(processOneJob("w-test", d)).resolves.toBe("succeeded");
    expect(leaseNextJob).toHaveBeenCalledWith(
      expect.objectContaining({ workerId: "w-test" })
    );
    expect(d.handlers.resolveProviderVoiceId).toHaveBeenCalledWith("v1");
    expect(d.handlers.generateSpeech).toHaveBeenCalledWith(
      "cb_voice_1",
      "Once upon a time"
    );
    expect(completeJob).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        providerVoiceId: "cb_voice_1",
        voiceId: "v1",
        audioUrl: "/uploads/voice-jobs/job_1.wav",
        bytes: 9,
        chars: 16,
      })
    );
    expect(failJob).not.toHaveBeenCalled();
  });

  it("uses payload.providerVoiceId directly without resolving", async () => {
    const d = deps();
    leaseNextJob.mockResolvedValue(
      makeJob({ payload: { providerVoiceId: "cb_direct", text: "hi" } })
    );
    await expect(processOneJob("w-test", d)).resolves.toBe("succeeded");
    expect(d.handlers.resolveProviderVoiceId).not.toHaveBeenCalled();
    expect(d.handlers.generateSpeech).toHaveBeenCalledWith("cb_direct", "hi");
  });

  it("requeues (non-permanent) when the voice is not cloned yet", async () => {
    const d = deps();
    d.handlers.resolveProviderVoiceId = vi.fn(async () => null);
    leaseNextJob.mockResolvedValue(
      makeJob({ payload: { voiceId: "v1", text: "hello" } })
    );
    await expect(processOneJob("w-test", d)).resolves.toBe("failed");
    expect(failJob).toHaveBeenCalledWith(
      "job_1",
      expect.stringContaining("no provider voice id"),
      { permanent: false }
    );
    expect(completeJob).not.toHaveBeenCalled();
  });

  it("fails permanently when clip_generate payload has no text", async () => {
    leaseNextJob.mockResolvedValue(makeJob({ payload: { voiceId: "v1" } }));
    await expect(processOneJob("w-test", deps())).resolves.toBe("failed");
    expect(failJob).toHaveBeenCalledWith(
      "job_1",
      expect.stringContaining("'text'"),
      { permanent: true }
    );
  });

  it("fails permanently for unimplemented job types instead of faking success", async () => {
    for (const type of ["singing_train", "lora_train", "talking_video"] as const) {
      vi.clearAllMocks();
      completeJob.mockResolvedValue(undefined);
      failJob.mockResolvedValue(undefined);
      leaseNextJob.mockResolvedValue(makeJob({ type }));
      await expect(processOneJob("w-test", deps())).resolves.toBe("failed");
      expect(failJob).toHaveBeenCalledWith(
        "job_1",
        expect.stringContaining("not implemented"),
        { permanent: true }
      );
      expect(completeJob).not.toHaveBeenCalled();
    }
  });

  it("routes provider errors to failJob as retryable", async () => {
    const d = deps();
    d.handlers.generateSpeech = vi.fn(async () => {
      throw new Error("chatterbox unreachable");
    });
    leaseNextJob.mockResolvedValue(
      makeJob({ payload: { providerVoiceId: "cb_1", text: "hello" } })
    );
    await expect(processOneJob("w-test", d)).resolves.toBe("failed");
    expect(failJob).toHaveBeenCalledWith("job_1", "chatterbox unreachable", {
      permanent: false,
    });
  });
});

describe("runVoiceWorker loop", () => {
  it("processes jobs until maxJobs and reports the count", async () => {
    leaseNextJob.mockResolvedValue(
      makeJob({ payload: { providerVoiceId: "cb_1", text: "hello" } })
    );
    const result = await runVoiceWorker({
      workerId: "w-loop",
      pollIntervalMs: 1,
      maxJobs: 2,
      leaseNextJob,
      completeJob,
      failJob,
      handlers: makeHandlers(),
    });
    expect(result).toEqual({ processed: 2 });
    expect(completeJob).toHaveBeenCalledTimes(2);
  });
});

describe("processVoiceJob dispatch", () => {
  it("clones via the provider when a voice_clone payload carries audio", async () => {
    const handlers = makeHandlers();
    const job = makeJob({
      type: "voice_clone",
      payload: {
        audioBase64: Buffer.from("sample").toString("base64"),
        name: "Grandma",
      },
    });
    await expect(processVoiceJob(job, handlers)).resolves.toEqual({
      providerVoiceId: "cb_clone_1",
    });
    expect(handlers.cloneVoice).toHaveBeenCalledWith(
      Buffer.from("sample"),
      "Grandma"
    );
  });

  it("rejects a voice_clone payload without audio as permanent", async () => {
    const job = makeJob({ type: "voice_clone", payload: { voiceId: "v1" } });
    await expect(processVoiceJob(job, makeHandlers())).rejects.toBeInstanceOf(
      PermanentJobError
    );
  });

  it("rejects unknown job types as permanent", async () => {
    const job = makeJob({ type: "mystery" as VoiceJob["type"] });
    await expect(processVoiceJob(job, makeHandlers())).rejects.toThrow(
      /Unknown voice job type/
    );
  });
});
