import { describe, it, expect, vi } from "vitest";

const deleteVoice = vi.fn();
vi.mock("@/lib/elevenlabs", () => ({ cloneVoice: vi.fn(), generateSpeech: vi.fn(), deleteVoice: (...a: unknown[]) => deleteVoice(...a) }));

import { getVoiceProvider, deleteVoice as del } from "@/lib/voice-provider";

describe("voice provider", () => {
  it("defaults to elevenlabs and delegates", async () => {
    expect(getVoiceProvider().name).toBe("elevenlabs");
    await del("v1");
    expect(deleteVoice).toHaveBeenCalledWith("v1");
  });
  it("rejects unknown providers", () => {
    expect(() => getVoiceProvider("nope")).toThrow(/Unknown VOICE_PROVIDER/);
  });
});
