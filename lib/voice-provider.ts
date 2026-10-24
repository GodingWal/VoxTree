import * as chatterbox from "./chatterbox";

/**
 * Provider-neutral voice API. Routes depend on this module, never on a
 * concrete engine client. The only implementation is the self-hosted
 * Chatterbox service (workers/chatterbox) — decided Oct 24, 2026: voice
 * cloning/TTS runs locally and no other voice model is used.
 */
export interface VoiceProvider {
  readonly name: string;
  /** Clone a voice from a consented sample; returns the provider's voice id. */
  cloneVoice: (audioBuffer: Buffer, name: string) => Promise<string>;
  /** Synthesize speech with a cloned voice; returns audio bytes. */
  generateSpeech: (voiceId: string, text: string) => Promise<Buffer>;
  /** Permanently delete a cloned voice at the provider. */
  deleteVoice: (voiceId: string) => Promise<void>;
}

const providers: Record<string, () => VoiceProvider> = {
  chatterbox: () => ({
    name: "chatterbox",
    // Indirection (not captured references) keeps test mocks of ./chatterbox effective.
    cloneVoice: (...a) => chatterbox.cloneVoice(...a),
    generateSpeech: (...a) => chatterbox.generateSpeech(...a),
    deleteVoice: (...a) => chatterbox.deleteVoice(...a),
  }),
};

export function getVoiceProvider(name = process.env.VOICE_PROVIDER ?? "chatterbox"): VoiceProvider {
  const factory = providers[name];
  if (!factory) {
    throw new Error(`Unknown VOICE_PROVIDER "${name}". Available: ${Object.keys(providers).join(", ")}`);
  }
  return factory();
}

export const cloneVoice: VoiceProvider["cloneVoice"] = (...a) => getVoiceProvider().cloneVoice(...a);
export const generateSpeech: VoiceProvider["generateSpeech"] = (...a) => getVoiceProvider().generateSpeech(...a);
export const deleteVoice: VoiceProvider["deleteVoice"] = (...a) => getVoiceProvider().deleteVoice(...a);
