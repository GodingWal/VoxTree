import { describe, it, expect, vi } from "vitest";

const deleteVoice = vi.fn();
const convertSpeech = vi.fn();
vi.mock("@/lib/seedvc", () => ({ cloneVoice: vi.fn(), convertSpeech: (...a: unknown[]) => convertSpeech(...a), deleteVoice: (...a: unknown[]) => deleteVoice(...a) }));

import { getVoiceProvider, deleteVoice as del, convertSpeech as conv } from "@/lib/voice-provider";

describe("voice provider", () => {
  it("defaults to seedvc and delegates", async () => {
    expect(getVoiceProvider().name).toBe("seedvc");
    await del("sv_1");
    expect(deleteVoice).toHaveBeenCalledWith("sv_1");
    await conv("sv_1", Buffer.from("source"));
    expect(convertSpeech).toHaveBeenCalledWith("sv_1", Buffer.from("source"));
  });
  it("rejects unknown providers", () => {
    expect(() => getVoiceProvider("nope")).toThrow(/Unknown VOICE_PROVIDER/);
  });
});
