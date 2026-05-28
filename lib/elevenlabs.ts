import { withRetry, isRetryableStatus, HttpError } from "./retry";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

function getApiKey(): string | null {
  return process.env.ELEVENLABS_API_KEY || null;
}

async function callElevenLabs(
  path: string,
  init: RequestInit
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(`${ELEVENLABS_BASE_URL}${path}`, init);
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

/**
 * Clone a voice using ElevenLabs voice cloning API.
 * Uploads an audio sample and returns the new voice ID.
 */
export async function cloneVoice(
  audioBuffer: Buffer,
  name: string
): Promise<string> {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn(
      "No ELEVENLABS_API_KEY found. Simulating Voice Cloning for development."
    );
    await new Promise((r) => setTimeout(r, 2000));
    return `simulated_voice_id_${Date.now()}`;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append(
    "files",
    new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" }),
    "sample.mp3"
  );

  const response = await callElevenLabs("/voices/add", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: formData,
  });

  const data = await response.json();
  return data.voice_id;
}

/**
 * Generate speech audio from text using an ElevenLabs voice.
 */
export async function generateSpeech(
  voiceId: string,
  text: string
): Promise<Buffer> {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn("No ELEVENLABS_API_KEY found. Simulating Speech Generation.");
    return Buffer.from([]);
  }

  let targetVoiceId = voiceId;
  if (voiceId.startsWith("simulated_voice_id_")) {
    console.warn(
      "Using simulated voice ID with real API Key. Fetching available voices from ElevenLabs account..."
    );
    try {
      const voicesRes = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
        headers: { "xi-api-key": apiKey },
      });
      if (voicesRes.ok) {
        const voicesData = await voicesRes.json();
        const activeVoice = voicesData.voices?.[0];
        targetVoiceId = activeVoice?.voice_id ?? "21m00Tcm4TlvDq8ikWAM";
      } else {
        targetVoiceId = "21m00Tcm4TlvDq8ikWAM";
      }
    } catch {
      targetVoiceId = "21m00Tcm4TlvDq8ikWAM";
    }
  }

  const response = await callElevenLabs(`/text-to-speech/${targetVoiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete a cloned voice from ElevenLabs.
 */
export async function deleteVoice(voiceId: string): Promise<void> {
  const apiKey = getApiKey();

  if (!apiKey || voiceId.startsWith("simulated_voice_id_")) {
    return;
  }

  try {
    await withRetry(
      async () => {
        const response = await fetch(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
          method: "DELETE",
          headers: { "xi-api-key": apiKey },
        });
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
