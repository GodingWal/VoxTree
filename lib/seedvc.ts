import { withRetry, isRetryableStatus, HttpError } from "./retry";
import { assertSimulationAllowed } from "./env";

/**
 * Client for the self-hosted SeedVC voice service (workers/seedvc).
 * SeedVC is VoxTree's only voice engine (decided Nov 2, 2026, replacing
 * the previous TTS engine): it performs zero-shot voice *conversion* —
 * a stored, consented reference recording defines the target voice, and
 * a source performance (the master reading of a lesson) is converted
 * into that voice. It cannot synthesize speech from text, so every
 * conversion call must carry source audio. No voice data leaves our own
 * infrastructure.
 */

const DEFAULT_SERVICE_URL = "http://localhost:8001";

export function getSeedvcServiceUrl(): string {
  return (process.env.SEEDVC_SERVICE_URL || DEFAULT_SERVICE_URL).replace(
    /\/+$/,
    ""
  );
}

async function callService(path: string, init: RequestInit): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(`${getSeedvcServiceUrl()}${path}`, init);
      if (!response.ok) {
        const text = await response.text();
        throw new HttpError(response.status, text);
      }
      return response;
    },
    {
      attempts: 3,
      baseDelayMs: 1000,
      shouldRetry: (err) =>
        err instanceof HttpError ? isRetryableStatus(err.status) : true,
    }
  );
}

function isSimulatedVoiceId(voiceId: string): boolean {
  return voiceId.startsWith("simulated_voice_id_");
}

/**
 * Register a cloned voice from a consented sample. Uploads the audio to
 * the SeedVC service, which stores it as the voice's target reference
 * and returns the new voice id.
 */
export async function cloneVoice(
  audioBuffer: Buffer,
  name: string
): Promise<string> {
  const formData = new FormData();
  formData.append("name", name);
  formData.append(
    "file",
    new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" }),
    "sample.mp3"
  );

  const response = await callService("/voices/clone", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  return data.voice_id;
}

export interface ConvertSpeechOptions {
  /** Diffusion steps (service default 25). */
  diffusionSteps?: number;
  /** Length adjustment factor (default 1.0). */
  lengthAdjust?: number;
  /** Inference classifier-free-guidance rate (default 0.7). */
  inferenceCfgRate?: number;
  /** Use the F0-conditioned (singing, 44.1 kHz) model instead of the
   *  speech model (22.05 kHz). */
  f0Condition?: boolean;
  autoF0Adjust?: boolean;
  /** Pitch shift in semitones (singing). */
  pitchShift?: number;
}

/**
 * Convert a source performance into the cloned voice. `sourceAudio` is
 * a recording of someone performing the content (e.g. the master
 * reading of a lesson); SeedVC re-voices it with the target voice's
 * timbre while keeping the source's timing and prosody. Returns the
 * converted audio (WAV).
 */
export async function convertSpeech(
  voiceId: string,
  sourceAudio: Buffer,
  options: ConvertSpeechOptions = {}
): Promise<Buffer> {
  if (isSimulatedVoiceId(voiceId)) {
    // Stored fake ids from simulation mode must never reach the real
    // service; in production this throws before any network call.
    assertSimulationAllowed("Simulated voice");
    throw new Error(`Unknown voice id: ${voiceId}`);
  }
  if (!sourceAudio || sourceAudio.length === 0) {
    throw new Error(
      "seedvc_requires_source_audio: SeedVC converts a source performance; no source audio was provided"
    );
  }

  const formData = new FormData();
  formData.append("voice_id", voiceId);
  formData.append(
    "source",
    new Blob([new Uint8Array(sourceAudio)], { type: "audio/wav" }),
    "source.wav"
  );
  if (options.diffusionSteps !== undefined)
    formData.append("diffusion_steps", String(options.diffusionSteps));
  if (options.lengthAdjust !== undefined)
    formData.append("length_adjust", String(options.lengthAdjust));
  if (options.inferenceCfgRate !== undefined)
    formData.append("inference_cfg_rate", String(options.inferenceCfgRate));
  if (options.f0Condition !== undefined)
    formData.append("f0_condition", String(options.f0Condition));
  if (options.autoF0Adjust !== undefined)
    formData.append("auto_f0_adjust", String(options.autoF0Adjust));
  if (options.pitchShift !== undefined)
    formData.append("pitch_shift", String(options.pitchShift));

  const response = await callService("/convert", {
    method: "POST",
    body: formData,
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete a cloned voice: removes its stored reference audio from the
 * SeedVC service. A voice that is already gone counts as deleted.
 */
export async function deleteVoice(voiceId: string): Promise<void> {
  if (isSimulatedVoiceId(voiceId)) {
    assertSimulationAllowed("Simulated voice deletion");
    return;
  }

  try {
    await withRetry(
      async () => {
        const response = await fetch(
          `${getSeedvcServiceUrl()}/voices/${encodeURIComponent(voiceId)}`,
          { method: "DELETE" }
        );
        if (response.status === 404) return; // already gone — treat as success
        if (!response.ok) {
          throw new HttpError(response.status, await response.text());
        }
      },
      {
        attempts: 3,
        baseDelayMs: 1000,
        shouldRetry: (err) =>
          err instanceof HttpError ? isRetryableStatus(err.status) : true,
      }
    );
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return;
    throw err;
  }
}
