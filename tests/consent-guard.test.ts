import { describe, it, expect, vi, beforeEach } from "vitest";

const hasConsent = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/consent", async () => {
  const { NextResponse } = await import("next/server");
  return {
    hasActiveConsent: (...a: unknown[]) => hasConsent(...a),
    requireActiveConsent: async (...a: unknown[]) =>
      (await hasConsent(...a))
        ? null
        : NextResponse.json({ error: "consent", consentRequired: true }, { status: 403 }),
  };
});

// Phase 4: routes resolve identity via lib/auth/session and data via
// Drizzle (lib/db). The db mock is a universal thenable chain resolving
// a plausible owned row for selects (the Drizzle analogue of the old
// PostgREST chain mock, in camelCase).
vi.mock("@/lib/auth/session", () => ({
  getCurrentUserId: async () => (await getUser()).data.user?.id ?? null,
  getCurrentUser: async () => {
    const u = (await getUser()).data.user;
    return u ? { id: u.id, email: "u1@example.com", name: "U One", plan: "premium" } : null;
  },
  requireUserId: async () => "u1",
  requireUser: async () => ({ id: "u1" }),
}));

vi.mock("@/lib/db", () => {
  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "u1",
    status: "ready",
    loraStatus: "idle",
    plan: "premium",
    consentVerified: true,
    voiceSlotsUsed: 0,
    videosUsed: 0,
    storiesUsed: 0,
    value: 0,
  };
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of [
      "from", "where", "limit", "orderBy", "leftJoin", "innerJoin",
      "groupBy", "values", "set", "returning", "onConflictDoUpdate",
      "onConflictDoNothing",
    ]) c[m] = () => c;
    c.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
      Promise.resolve(result).then(res, rej);
    return c;
  };
  return {
    db: {
      select: () => chain([row]),
      insert: () => chain([row]),
      update: () => chain([{ id: row.id }]),
      delete: () => chain([]),
      execute: async () => ({ rows: [{ allowed: true }] }),
    },
  };
});
vi.mock("@/lib/api-helpers", async (orig) => ({
  ...((await orig()) as object),
  enforcePaidRateLimit: async () => null,
  enforceUserRateLimit: async () => null,
}));
vi.mock("@/lib/replicate", () => ({ replicate: null, trainCharacterLora: vi.fn(), trainSingingModel: vi.fn(), runPixarLoraInference: vi.fn() }));
vi.mock("@/lib/voice-provider", () => ({ generateSpeech: vi.fn(), cloneVoice: vi.fn(), deleteVoice: vi.fn() }));
vi.mock("@/lib/hedra", () => ({ createTalkingVideo: vi.fn(), isHedraConfigured: () => true, uploadAsset: vi.fn() }));
vi.mock("@/lib/gcp", () => ({ getPresignedDownloadUrl: vi.fn() }));
vi.mock("@/lib/cost-tracking", () => ({ checkCostCap: async () => ({ allowed: true }), recordUsage: vi.fn() }));

const uuid = "11111111-1111-4111-8111-111111111111";
const json = (body: unknown) =>
  new Request("http://x/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const form = () => {
  const fd = new FormData();
  fd.set("voiceId", uuid);
  return new Request("http://x/api", { method: "POST", body: fd });
};
const params = { params: Promise.resolve({ id: uuid }) };

type Case = [string, () => Promise<Response>];
const cases: Case[] = [
  ["clips/talking-video", async () => (await import("@/app/api/clips/talking-video/route")).POST(json({ voiceId: uuid, text: "hello" }) as never)],
  ["avatar/generate", async () => (await import("@/app/api/avatar/generate/route")).POST(json({ voiceId: uuid, imageUrl: "/x.png" }) as never)],
  ["avatar/generate-pixar", async () => (await import("@/app/api/avatar/generate-pixar/route")).POST(json({ voiceId: uuid }) as never)],
  ["avatar/train", async () => (await import("@/app/api/avatar/train/route")).POST(form() as never)],
  ["voices/singing/train", async () => (await import("@/app/api/voices/singing/train/route")).POST(json({ voiceId: uuid }))],
  ["voices/[id]/capture", async () => (await import("@/app/api/voices/[id]/capture/route")).POST(json({ image: "data:image/png;base64,AAAA" }) as never, params)],
  ["voices/[id]/omni-upload", async () => (await import("@/app/api/voices/[id]/omni-upload/route")).POST(form() as never, params)],
];

describe("biometric routes require active consent", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it.each(cases)("%s returns 403 when consent is revoked", async (_name, call) => {
    hasConsent.mockResolvedValue(false);
    const res = await call();
    expect(res.status).toBe(403);
    expect((await res.json()).consentRequired).toBe(true);
  });

  it.each(cases)("%s does not 403 when consent is active", async (_name, call) => {
    hasConsent.mockResolvedValue(true);
    const res = await call().catch(() => new Response(null, { status: 500 }));
    expect(res.status).not.toBe(403);
  });
});
