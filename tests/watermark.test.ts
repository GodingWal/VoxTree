import { describe, it, expect } from "vitest";
import {
  embedWatermark,
  applyWatermark,
  extractWatermark,
  hasWatermark,
  removeWatermark,
  verifyWatermark,
  createWatermarkPayload,
} from "../lib/watermark";

describe("watermark", () => {
  const payload = { clipId: "clip-123", userId: "user-abc", timestamp: 1700000000000 };

  it("embed and extract round-trips", () => {
    const audio = Buffer.from("fake-mp3-data-".repeat(50));
    const wm = embedWatermark(audio, payload);
    expect(wm.length).toBeGreaterThan(audio.length);
    const extracted = extractWatermark(wm);
    expect(extracted).not.toBeNull();
    expect(extracted?.clipId).toBe(payload.clipId);
    expect(extracted?.userId).toBe(payload.userId);
    expect(extracted?.timestamp).toBe(payload.timestamp);
    expect(extracted?.version).toBe("v1");
  });

  it("hasWatermark detects presence", () => {
    const audio = Buffer.from("hello world");
    expect(hasWatermark(audio)).toBe(false);
    const wm = applyWatermark(audio, payload);
    expect(hasWatermark(wm)).toBe(true);
  });

  it("removeWatermark strips trailer and restores original length", () => {
    const audio = Buffer.from("original-audio-bytes");
    const wm = embedWatermark(audio, payload);
    const stripped = removeWatermark(wm);
    expect(stripped.equals(audio)).toBe(true);
    expect(hasWatermark(stripped)).toBe(false);
  });

  it("embed is idempotent for same clipId (does not double trailer)", () => {
    const audio = Buffer.from("audio-data");
    const wm1 = embedWatermark(audio, payload);
    const wm2 = embedWatermark(wm1, payload);
    expect(wm2.length).toBe(wm1.length);
    expect(extractWatermark(wm2)?.clipId).toBe(payload.clipId);
  });

  it("verifyWatermark checks clip/user", () => {
    const audio = Buffer.from("audio");
    const wm = embedWatermark(audio, payload);
    expect(verifyWatermark(wm, { clipId: "clip-123", userId: "user-abc" })).toBe(true);
    expect(verifyWatermark(wm, { clipId: "wrong" })).toBe(false);
    expect(verifyWatermark(wm, { userId: "wrong" })).toBe(false);
    expect(verifyWatermark(Buffer.from("no wm"), { clipId: "clip-123" })).toBe(false);
  });

  it("preserves binary audio content after embed/strip", () => {
    // Create a buffer with non-utf8 bytes
    const binary = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) binary[i] = i;
    const wm = embedWatermark(binary, payload);
    const stripped = removeWatermark(wm);
    expect(stripped.equals(binary)).toBe(true);
  });

  it("createWatermarkPayload helper", () => {
    const p = createWatermarkPayload("c1", "u1", 12345);
    expect(p.clipId).toBe("c1");
    expect(p.userId).toBe("u1");
    expect(p.timestamp).toBe(12345);
    expect(p.version).toBe("v1");
  });

  it("extract returns null for non-watermarked buffer", () => {
    expect(extractWatermark(Buffer.from("random"))).toBeNull();
  });

  it("does not corrupt when buffer contains MAGIC-like substring but invalid base64", () => {
    const fake = Buffer.from("VOXTREE_WM:notbase64:END");
    expect(extractWatermark(fake)).toBeNull();
    expect(hasWatermark(fake)).toBe(false);
  });
});
