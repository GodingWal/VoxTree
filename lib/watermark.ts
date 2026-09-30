const MAGIC = Buffer.from("\nVOXTREE_WM:", "utf8");
const END = Buffer.from(":END", "utf8");

export type WatermarkPayload = {
  clipId: string;
  userId: string;
  timestamp: number;
  version?: "v1";
};

export function createWatermarkPayload(clipId: string, userId: string, timestamp = Date.now()): Required<WatermarkPayload> {
  return { clipId, userId, timestamp, version: "v1" };
}

export function extractWatermark(audio: Buffer): Required<WatermarkPayload> | null {
  const start = audio.lastIndexOf(MAGIC);
  if (start < 0 || !audio.subarray(audio.length - END.length).equals(END)) return null;
  const encoded = audio.subarray(start + MAGIC.length, audio.length - END.length).toString("utf8");
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<WatermarkPayload>;
    if (typeof parsed.clipId !== "string" || typeof parsed.userId !== "string" || typeof parsed.timestamp !== "number") return null;
    return { clipId: parsed.clipId, userId: parsed.userId, timestamp: parsed.timestamp, version: "v1" };
  } catch {
    return null;
  }
}

export function removeWatermark(audio: Buffer): Buffer {
  if (!extractWatermark(audio)) return audio;
  return audio.subarray(0, audio.lastIndexOf(MAGIC));
}

export function embedWatermark(audio: Buffer, payload: WatermarkPayload): Buffer {
  const existing = extractWatermark(audio);
  if (existing?.clipId === payload.clipId) return audio;
  const clean = removeWatermark(audio);
  const encoded = Buffer.from(JSON.stringify(createWatermarkPayload(payload.clipId, payload.userId, payload.timestamp)), "utf8").toString("base64url");
  return Buffer.concat([clean, MAGIC, Buffer.from(encoded, "utf8"), END]);
}

export const applyWatermark = embedWatermark;

export function hasWatermark(audio: Buffer): boolean {
  return extractWatermark(audio) !== null;
}

export function verifyWatermark(audio: Buffer, expected: { clipId?: string; userId?: string }): boolean {
  const payload = extractWatermark(audio);
  if (!payload) return false;
  return (expected.clipId === undefined || payload.clipId === expected.clipId)
    && (expected.userId === undefined || payload.userId === expected.userId);
}
