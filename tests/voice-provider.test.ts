import { describe, it, expect, vi } from "vitest";

const deleteVoice = vi.fn();
vi.mock("@/lib/chatterbox", () => ({ cloneVoice: vi.fn(), generateSpeech: vi.fn(), deleteVoice: (...a: unknown[]) => deleteVoice(...a) }));

import { getVoiceProvider, deleteVoice as del } from "@/lib/voice-provider";

describe("voice provider", () => {
  it("defaults to chatterbox and delegates", async () => {
    expect(getVoiceProvider().name).toBe("chatterbox");
    await del("cb_1");
    expect(deleteVoice).toHaveBeenCalledWith("cb_1");
  });
  it("rejects unknown providers", () => {
    expect(() => getVoiceProvider("nope")).toThrow(/Unknown VOICE_PROVIDER/);
  });
});
