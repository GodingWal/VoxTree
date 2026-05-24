const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

function getApiKey(): string | null {
  return process.env.ELEVENLABS_API_KEY || null;
}

/**
 * Clone a voice using ElevenLabs v3 voice cloning API.
 * Uploads an audio sample and returns the new voice ID.
 */
export async function cloneVoice(
  audioBuffer: Buffer,
  name: string
): Promise<string> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.warn("No ELEVENLABS_API_KEY found. Simulating Voice Cloning for development.");
    // Simulate API delay
    await new Promise(r => setTimeout(r, 2000));
    return `simulated_voice_id_${Date.now()}`;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append(
    "files",
    new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" }),
    "sample.mp3"
  );

  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(`${ELEVENLABS_BASE_URL}/voices/add`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: formData,
    });
    if (response.ok) break;
    // Simple exponential backoff
    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
  }

  if (!response?.ok) {
    const error = await response?.text();
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
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.warn("No ELEVENLABS_API_KEY found. Simulating Speech Generation.");
    return Buffer.from([]);
  }

  let targetVoiceId = voiceId;
  if (voiceId.startsWith("simulated_voice_id_")) {
    console.warn("Using simulated voice ID with real API Key. Fetching available voices from ElevenLabs account...");
    try {
      const voicesRes = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
        headers: {
          "xi-api-key": apiKey,
        },
      });
      if (voicesRes.ok) {
        const voicesData = await voicesRes.json();
        const activeVoice = voicesData.voices?.[0];
        if (activeVoice) {
          console.log(`Fallback voice found: ${activeVoice.name} (${activeVoice.voice_id})`);
          targetVoiceId = activeVoice.voice_id;
        } else {
          console.warn("No voices found in ElevenLabs account. Using default Rachel voice.");
          targetVoiceId = "21m00Tcm4TlvDq8ikWAM";
        }
      } else {
        console.warn("Failed to fetch voices from ElevenLabs. Using default Rachel voice.");
        targetVoiceId = "21m00Tcm4TlvDq8ikWAM";
      }
    } catch (err) {
      console.error("Error fetching voices from ElevenLabs:", err);
      targetVoiceId = "21m00Tcm4TlvDq8ikWAM";
    }
  }

  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${targetVoiceId}`,
      {
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
      }
    );
    if (response.ok) break;
    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
  }

  if (!response?.ok) {
    const error = await response?.text();
    throw new Error(`ElevenLabs speech generation failed: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete a cloned voice from ElevenLabs.
 */
export async function deleteVoice(voiceId: string): Promise<void> {
  const apiKey = getApiKey();
  
  if (!apiKey || voiceId.startsWith("simulated_voice_id_")) {
    return; // Simulated deletion
  }

  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
    method: "DELETE",
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs voice deletion failed: ${error}`);
  }
}
