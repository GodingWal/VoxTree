const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not configured");
  return key;
}

/**
 * Clone a voice using ElevenLabs v3 voice cloning API.
 * Uploads an audio sample and returns the new voice ID.
 */
export async function cloneVoice(
  audioBuffer: Buffer,
  name: string
): Promise<string> {
  const formData = new FormData();
  formData.append("name", name);
  formData.append(
    "files",
    new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" }),
    "sample.mp3"
  );

  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices/add`, {
    method: "POST",
    headers: {
      "xi-api-key": getApiKey(),
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs voice cloning failed: ${error}`);
  }

  const data = await response.json();
  return data.voice_id;
}

/**
 * Generate speech audio from text using an ElevenLabs voice.
 * Uses eleven_turbo_v2_5 model for fast generation.
 */
export async function generateSpeech(
  voiceId: string,
  text: string
): Promise<Buffer> {
  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": getApiKey(),
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
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs speech generation failed: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete a cloned voice from ElevenLabs.
 */
export async function deleteVoice(voiceId: string): Promise<void> {
  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
    method: "DELETE",
    headers: {
      "xi-api-key": getApiKey(),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs voice deletion failed: ${error}`);
  }
}
