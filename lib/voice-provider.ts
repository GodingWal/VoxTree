import * as seedvc from "./seedvc";

/**
 * Provider-neutral voice API. Routes depend on this module, never on a
 * concrete engine client. The only implementation is the self-hosted
 * SeedVC service (workers/seedvc) — decided Nov 2, 2026 (replacing the
 * previous TTS engine): voice conversion runs locally and no other
 * voice model is used.
 *
 * SeedVC is a voice *conversion* engine, not text-to-speech: the
 * generation call is `convertSpeech`, which re-voices a recorded source
 * performance (the master reading) into the cloned target voice. There
 * is deliberately no text-in/audio-out method on this interface.
 */
export interface VoiceProvider {
  readonly name: string;
  /** Register a cloned voice from a consented reference sample;
   *  returns the provider's voice id. */
  cloneVoice: (audioBuffer: Buffer, name: string) => Promise<string>;
  /** Convert a source performance into the cloned voice; returns the
   *  converted audio bytes. Throws when no source audio is given. */
  convertSpeech: (
    voiceId: string,
    sourceAudio: Buffer,
    options?: seedvc.ConvertSpeechOptions
  ) => Promise<Buffer>;
  /** Permanently delete a cloned voice at the provider. */
  deleteVoice: (voiceId: string) => Promise<void>;
}

const providers: Record<string, () => VoiceProvider> = {
  seedvc: () => ({
    name: "seedvc",
    // Indirection (not captured references) keeps test mocks of ./seedvc effective.
    cloneVoice: (...a) => seedvc.cloneVoice(...a),
    convertSpeech: (...a) => seedvc.convertSpeech(...a),
    deleteVoice: (...a) => seedvc.deleteVoice(...a),
  }),
};

export function getVoiceProvider(name = process.env.VOICE_PROVIDER ?? "seedvc"): VoiceProvider {
  const factory = providers[name];
  if (!factory) {
    throw new Error(`Unknown VOICE_PROVIDER "${name}". Available: ${Object.keys(providers).join(", ")}`);
  }
  return factory();
}

export const cloneVoice: VoiceProvider["cloneVoice"] = (...a) => getVoiceProvider().cloneVoice(...a);
export const convertSpeech: VoiceProvider["convertSpeech"] = (...a) => getVoiceProvider().convertSpeech(...a);
export const deleteVoice: VoiceProvider["deleteVoice"] = (...a) => getVoiceProvider().deleteVoice(...a);
export type { ConvertSpeechOptions } from "./seedvc";
