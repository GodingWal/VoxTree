import { withRetry, isRetryableStatus, HttpError } from "./retry";
import { assertSimulationAllowed } from "./env";

/**
 * Client for the self-hosted Chatterbox voice service
 * (workers/chatterbox). Chatterbox is VoxTree's only voice engine:
 * cloning stores a consented reference recording on the service, and
 * synthesis replays it as the model's audio prompt. No voice data
 * leaves our own infrastructure.
 */

const DEFAULT_SERVICE_URL = "http://localhost:8001";

export function getChatterboxServiceUrl(): string {
  return (process.env.CHATTERBOX_SERVICE_URL || DEFAULT_SERVICE_URL).replace(
    /\/+$/,
    ""
  );
}

async function callService(path: string, init: RequestInit): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(`${getChatterboxServiceUrl()}${path}`, init);
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
 * Clone a voice from a consented sample. Uploads the audio to the
 * Chatterbox service, which stores it as the voice's reference and
 * returns the new voice id.
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

/**
 * Generate speech audio (WAV) from text using a cloned voice.
 */
export async function generateSpeech(
  voiceId: string,
  text: string
): Promise<Buffer> {
  if (isSimulatedVoiceId(voiceId)) {
    // Stored fake ids from simulation mode must never reach the real
    // service; in production this throws before any network call.
    assertSimulationAllowed("Simulated voice");
    throw new Error(`Unknown voice id: ${voiceId}`);
  }

  const response = await callService("/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice_id: voiceId, text }),
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete a cloned voice: removes its stored reference audio from the
 * Chatterbox service. A voice that is already gone counts as deleted.
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
          `${getChatterboxServiceUrl()}/voices/${encodeURIComponent(voiceId)}`,
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
