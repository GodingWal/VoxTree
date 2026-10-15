import * as elevenlabs from "./elevenlabs";

/**
 * Provider-neutral voice API. Routes depend on this module, never on a vendor
 * SDK, so a self-hosted engine (F5-TTS, XTTS v2, Chatterbox) can be added as
 * another implementation without touching route code.
 */
export interface VoiceProvider {
  readonly name: string;
  /** Clone a voice from a consented sample; returns the provider's voice id. */
  cloneVoice: typeof elevenlabs.cloneVoice;
  /** Synthesize speech with a cloned voice; returns audio bytes. */
  generateSpeech: typeof elevenlabs.generateSpeech;
  /** Permanently delete a cloned voice at the provider. */
  deleteVoice: typeof elevenlabs.deleteVoice;
}

const providers: Record<string, () => VoiceProvider> = {
  elevenlabs: () => ({
    name: "elevenlabs",
    // Indirection (not captured references) keeps test mocks of ./elevenlabs effective.
    cloneVoice: (...a) => elevenlabs.cloneVoice(...a),
    generateSpeech: (...a) => elevenlabs.generateSpeech(...a),
    deleteVoice: (...a) => elevenlabs.deleteVoice(...a),
  }),
};

export function getVoiceProvider(name = process.env.VOICE_PROVIDER ?? "elevenlabs"): VoiceProvider {
  const factory = providers[name];
  if (!factory) {
    throw new Error(`Unknown VOICE_PROVIDER "${name}". Available: ${Object.keys(providers).join(", ")}`);
  }
  return factory();
}

export const cloneVoice: VoiceProvider["cloneVoice"] = (...a) => getVoiceProvider().cloneVoice(...a);
export const generateSpeech: VoiceProvider["generateSpeech"] = (...a) => getVoiceProvider().generateSpeech(...a);
export const deleteVoice: VoiceProvider["deleteVoice"] = (...a) => getVoiceProvider().deleteVoice(...a);
