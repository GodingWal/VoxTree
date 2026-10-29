import { eq } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";

import { db } from "./db";
import { familyVoices } from "./db/schema";
import { logger } from "./logger";
import { uploadUrl, uploadsFilePath } from "./uploads";
import {
  completeJob as completeJobImpl,
  failJob as failJobImpl,
  leaseNextJob as leaseNextJobImpl,
  type VoiceJob,
} from "./voice-jobs";
import {
  cloneVoice as providerCloneVoice,
  generateSpeech as providerGenerateSpeech,
} from "./voice-provider";

/**
 * Voice-job queue consumer (improvements report item 8).
 *
 * Jobs are enqueued with lib/voice-jobs.enqueueJob and leased atomically
 * through the `lease_voice_job()` SQL function. This module is the
 * missing consumer: `processOneJob` leases and dispatches a single job
 * (the unit tests drive exactly this), and `runVoiceWorker` loops it
 * with polling + graceful shutdown. Entrypoint: workers/voice/worker.ts
 * (`npm run worker:voice`).
 *
 * Dispatch, honestly scoped to what exists today:
 * - `clip_generate` — the only type enqueued in production (the sample
 *   dub from app/api/voices/create). Synthesizes `payload.text` with
 *   the voice's cloned provider voice via lib/voice-provider
 *   (Chatterbox) and stores the WAV under
 *   data/uploads/voice-jobs/<jobId>.wav, served by the authenticated
 *   /uploads route. It does NOT do the clips/generate route's full
 *   pipeline (content lookup, music mix, watermark, generated_clips
 *   row) — that route still processes inline.
 * - `voice_clone` — dispatched to the provider's cloneVoice when the
 *   payload carries `audioBase64` (+ optional `name`). No production
 *   caller enqueues this shape today (cloning runs inline in
 *   app/api/voices/process), so a payload without audio fails
 *   permanently instead of retrying a job that can never succeed.
 * - `singing_train`, `lora_train`, `talking_video` — no worker-side
 *   handler exists (singing/LoRA training run through Replicate routes
 *   and webhooks; talking video through the Hedra route, all inline).
 *   These fail PERMANENTLY with a "not implemented" error rather than
 *   faking success or burning retries.
 */

/** An error the job can never recover from by retrying (bad payload,
 *  unimplemented type). processOneJob passes { permanent: true } to
 *  failJob for these, which marks the job failed immediately instead
 *  of requeueing until max_attempts. */
export class PermanentJobError extends Error {
  readonly permanent = true;
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}

export interface VoiceJobHandlers {
  /** Resolve a family_voices id to its cloned provider voice id, or
   *  null when the voice does not exist / has not been cloned yet. */
  resolveProviderVoiceId: (voiceId: string) => Promise<string | null>;
  generateSpeech: (providerVoiceId: string, text: string) => Promise<Buffer>;
  cloneVoice: (audioBuffer: Buffer, name: string) => Promise<string>;
  /** Persist synthesized audio; returns its app URL + storage key. */
  saveAudio: (
    job: VoiceJob,
    audio: Buffer
  ) => Promise<{ audioUrl: string; storageKey: string }>;
}

export const defaultHandlers: VoiceJobHandlers = {
  async resolveProviderVoiceId(voiceId) {
    const [voice] = await db
      .select({ providerVoiceId: familyVoices.providerVoiceId })
      .from(familyVoices)
      .where(eq(familyVoices.id, voiceId))
      .limit(1);
    return voice?.providerVoiceId ?? null;
  },
  generateSpeech: (providerVoiceId, text) =>
    providerGenerateSpeech(providerVoiceId, text),
  cloneVoice: (audioBuffer, name) => providerCloneVoice(audioBuffer, name),
  async saveAudio(job, audio) {
    const storageKey = `voice-jobs/${job.id}.wav`;
    const filePath = uploadsFilePath(storageKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, audio);
    return { audioUrl: uploadUrl(storageKey), storageKey };
  },
};

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

async function handleClipGenerate(
  job: VoiceJob,
  handlers: VoiceJobHandlers
): Promise<Record<string, unknown>> {
  const text = payloadString(job.payload, "text");
  if (!text) {
    throw new PermanentJobError(
      "clip_generate payload is missing a non-empty 'text' field"
    );
  }

  let providerVoiceId = payloadString(job.payload, "providerVoiceId");
  const voiceId = payloadString(job.payload, "voiceId");
  if (!providerVoiceId) {
    if (!voiceId) {
      throw new PermanentJobError(
        "clip_generate payload needs 'providerVoiceId' or 'voiceId'"
      );
    }
    providerVoiceId = await handlers.resolveProviderVoiceId(voiceId);
    if (!providerVoiceId) {
      // Retryable on purpose: the sample dub is enqueued at voice-create
      // time, before the inline clone in /api/voices/process runs, so
      // "not cloned yet" can become ready. failJob requeues until
      // max_attempts, after which the job is marked failed.
      throw new Error(
        `Voice ${voiceId} has no provider voice id yet (not cloned)`
      );
    }
  }

  const audio = await handlers.generateSpeech(providerVoiceId, text);
  if (audio.length === 0) {
    throw new Error("Voice provider returned empty audio");
  }
  const saved = await handlers.saveAudio(job, audio);

  return {
    providerVoiceId,
    ...(voiceId ? { voiceId } : {}),
    audioUrl: saved.audioUrl,
    storageKey: saved.storageKey,
    bytes: audio.length,
    chars: text.length,
  };
}

async function handleVoiceClone(
  job: VoiceJob,
  handlers: VoiceJobHandlers
): Promise<Record<string, unknown>> {
  const audioBase64 = payloadString(job.payload, "audioBase64");
  if (!audioBase64) {
    throw new PermanentJobError(
      "voice_clone payload is missing 'audioBase64': no production caller enqueues a self-contained clone job today (cloning runs inline in app/api/voices/process), so this job can never succeed"
    );
  }
  const name =
    payloadString(job.payload, "name") ??
    payloadString(job.payload, "voiceName") ??
    "Voice";
  const providerVoiceId = await handlers.cloneVoice(
    Buffer.from(audioBase64, "base64"),
    name
  );
  return { providerVoiceId };
}

/** Dispatch one leased job by type. Returns the result to store on the
 *  job row; throws PermanentJobError for unrecoverable jobs and plain
 *  Errors for retryable failures. */
export async function processVoiceJob(
  job: VoiceJob,
  handlers: VoiceJobHandlers = defaultHandlers
): Promise<Record<string, unknown>> {
  switch (job.type) {
    case "clip_generate":
      return handleClipGenerate(job, handlers);
    case "voice_clone":
      return handleVoiceClone(job, handlers);
    case "singing_train":
    case "lora_train":
    case "talking_video":
      throw new PermanentJobError(
        `Voice job type "${job.type}" is not implemented by the voice worker (no worker-side handler exists; this flow runs inline via API routes today)`
      );
    default:
      throw new PermanentJobError(
        `Unknown voice job type "${job.type as string}"`
      );
  }
}

export interface VoiceWorkerDeps {
  leaseNextJob: typeof leaseNextJobImpl;
  completeJob: typeof completeJobImpl;
  failJob: typeof failJobImpl;
  handlers: VoiceJobHandlers;
  leaseSeconds?: number;
}

const defaultDeps: VoiceWorkerDeps = {
  leaseNextJob: leaseNextJobImpl,
  completeJob: completeJobImpl,
  failJob: failJobImpl,
  handlers: defaultHandlers,
};

export type ProcessOneOutcome = "empty" | "succeeded" | "failed";

/** Lease and process a single job. Returns "empty" when the queue has
 *  nothing runnable. Handler errors are routed to failJob (permanent
 *  for PermanentJobError, otherwise requeue-until-max_attempts per
 *  failJob's existing behavior). */
export async function processOneJob(
  workerId: string,
  deps: Partial<VoiceWorkerDeps> = {}
): Promise<ProcessOneOutcome> {
  const { leaseNextJob, completeJob, failJob, handlers, leaseSeconds } = {
    ...defaultDeps,
    ...deps,
  };

  const job = await leaseNextJob({ workerId, leaseSeconds });
  if (!job) return "empty";

  const logFields = { jobId: job.id, jobType: job.type, workerId };
  logger.info("voice_job_leased", {
    ...logFields,
    attempt: job.attempts,
    maxAttempts: job.max_attempts,
  });

  try {
    const result = await processVoiceJob(job, handlers);
    await completeJob(job.id, result);
    logger.info("voice_job_succeeded", logFields);
    return "succeeded";
  } catch (err) {
    const permanent = err instanceof PermanentJobError;
    const message = err instanceof Error ? err.message : String(err);
    await failJob(job.id, message, { permanent });
    logger.error("voice_job_failed", { ...logFields, permanent, message });
    return "failed";
  }
}

export interface VoiceWorkerOptions extends Partial<VoiceWorkerDeps> {
  workerId?: string;
  pollIntervalMs?: number;
  /** Stop after this many processed (non-empty) jobs. For tests/runs. */
  maxJobs?: number;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The worker loop: lease -> process -> repeat; sleep pollIntervalMs
 * when the queue is empty (or when leasing itself errors, e.g. the DB
 * is briefly down). SIGINT/SIGTERM set a stop flag that is honored
 * between jobs — an in-flight job always finishes (completes or fails)
 * before the loop exits.
 */
export async function runVoiceWorker(
  options: VoiceWorkerOptions = {}
): Promise<{ processed: number }> {
  const workerId =
    options.workerId ??
    process.env.VOICE_WORKER_ID ??
    `voice-worker-${process.pid}`;
  const pollIntervalMs =
    options.pollIntervalMs ??
    (Number(process.env.VOICE_WORKER_POLL_MS) > 0
      ? Number(process.env.VOICE_WORKER_POLL_MS)
      : 5000);

  let stopping = false;
  const onSignal = () => {
    stopping = true;
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  let processed = 0;
  logger.info("voice_worker_started", { workerId, pollIntervalMs });

  try {
    while (!stopping) {
      let outcome: ProcessOneOutcome;
      try {
        outcome = await processOneJob(workerId, options);
      } catch (err) {
        // Leasing/completion plumbing failed outside a job's handler
        // (e.g. DB unreachable): log, back off like an empty queue.
        logger.error("voice_worker_cycle_failed", {
          workerId,
          message: err instanceof Error ? err.message : String(err),
        });
        outcome = "empty";
      }

      if (outcome === "empty") {
        if (stopping) break;
        await sleep(pollIntervalMs);
      } else {
        processed += 1;
        if (options.maxJobs !== undefined && processed >= options.maxJobs) {
          break;
        }
      }
    }
  } finally {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
  }

  logger.info("voice_worker_stopped", { workerId, processed });
  return { processed };
}
