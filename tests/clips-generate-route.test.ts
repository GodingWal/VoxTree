import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Route-level tests for POST /api/clips/generate
 * (app/api/clips/generate/route.ts), focused on ORDERING and
 * reject-before-provider behavior.
 *
 * The synchronous pipeline order in the implementation is:
 *   enforcePaidRateLimit → getCurrentUser (401) → hasActiveConsent
 *   (403) → safeJson / zod validation (400) → enforceUserRateLimit →
 *   checkLimit "add_video" (403) → content-script abuse pre-check
 *   (403) → content fetch (404 / 400) → voice abuse check → cache
 *   lookup (early "ready" return) → stuck-clip cleanup → insert clip
 *   row → fire-and-forget background processing.
 * The voice provider (generateSpeech) is only reached inside that
 * background job, and even there the cost cap (checkCostCap) is
 * checked BEFORE generateSpeech for TTS content.
 *
 * Every collaborator is mocked; an `order` log records each mock's
 * invocation so tests assert relative order / non-invocation, not
 * just status codes. No real provider, DB, or network call happens
 * (global fetch is stubbed for the background job's file transfers).
 */

const order: string[] = [];
const track = (name: string) => {
  order.push(name);
};

const getUser = vi.fn();
const hasConsent = vi.fn();
const paidRateLimit = vi.fn();
const userRateLimit = vi.fn();
const checkLimitMock = vi.fn();
const checkAbuseMock = vi.fn();
const getCachedAudioMock = vi.fn();
const generateSpeechMock = vi.fn();
const checkCostCapMock = vi.fn();
const recordUsageMock = vi.fn();
const sendAlert = vi.fn();
const getPresignedUploadUrlMock = vi.fn();

const CONTENT_ID = "11111111-1111-4111-8111-111111111111";
const VOICE_ID = "22222222-2222-4222-8222-222222222222";
const USER = { id: "u1", email: "owner@example.com", name: "Owner" };

const state = vi.hoisted(() => ({
  contentRow: null as Record<string, unknown> | null,
  voiceRow: null as Record<string, unknown> | null,
  insertClip: true,
  selectTables: [] as string[],
  insertCalls: [] as Array<Record<string, unknown>>,
  updateCalls: 0,
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => {
    track("getCurrentUser");
    return (await getUser()) as unknown;
  },
  getCurrentUserId: async () => ((await getUser()) as { id?: string } | null)?.id ?? null,
}));

vi.mock("@/lib/consent", () => ({
  hasActiveConsent: async (...a: unknown[]) => {
    track("hasActiveConsent");
    return hasConsent(...a);
  },
}));

vi.mock("@/lib/api-helpers", async (orig) => ({
  ...((await orig()) as object),
  enforcePaidRateLimit: async (...a: unknown[]) => {
    track("enforcePaidRateLimit");
    return paidRateLimit(...a);
  },
  enforceUserRateLimit: async (...a: unknown[]) => {
    track("enforceUserRateLimit");
    return userRateLimit(...a);
  },
}));

vi.mock("@/lib/limits", () => ({
  checkLimit: async (...a: unknown[]) => {
    track("checkLimit");
    return checkLimitMock(...a);
  },
}));

vi.mock("@/lib/abuse-detection", () => ({
  checkAbuse: (...a: unknown[]) => {
    track("checkAbuse");
    return checkAbuseMock(...a);
  },
}));

vi.mock("@/lib/cache", () => ({
  getCachedAudio: async (...a: unknown[]) => {
    track("getCachedAudio");
    return getCachedAudioMock(...a);
  },
}));

vi.mock("@/lib/voice-provider", () => ({
  generateSpeech: async (...a: unknown[]) => {
    track("generateSpeech");
    return generateSpeechMock(...a);
  },
  cloneVoice: vi.fn(),
  deleteVoice: vi.fn(),
}));

vi.mock("@/lib/cost-tracking", () => ({
  checkCostCap: async (...a: unknown[]) => {
    track("checkCostCap");
    return checkCostCapMock(...a);
  },
  recordUsage: async (...a: unknown[]) => {
    track("recordUsage");
    return recordUsageMock(...a);
  },
}));

vi.mock("@/lib/monitoring", () => ({
  sendOperationalAlert: async (...a: unknown[]) => {
    track("sendOperationalAlert");
    return sendAlert(...a);
  },
}));

vi.mock("@/lib/gcp", () => ({
  getPresignedUploadUrl: async (...a: unknown[]) => {
    track("getPresignedUploadUrl");
    return getPresignedUploadUrlMock(...a);
  },
  GCP_PATHS: {
    clipAudio: (u: string, c: string, v: string) => `clips/${u}/${c}/${v}/audio.mp3`,
    consentVideoPrefix: (userId: string) => `consent-videos/${userId}/`,
  },
}));

vi.mock("@/lib/watermark", () => ({
  applyWatermark: (buf: Buffer) => buf,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("replicate", () => ({
  default: class MockReplicate {
    run = vi.fn(async () => "https://replicate.example/out.mp3");
  },
}));

vi.mock("@/lib/db", async () => {
  const { getTableName } = await import("drizzle-orm");
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit", "orderBy", "values", "set", "returning"]) c[m] = () => c;
    c.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
      Promise.resolve(result).then(res, rej);
    return c;
  };
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          const name = getTableName(table as never);
          state.selectTables.push(name);
          if (name === "content_library") {
            return chain(state.contentRow ? [state.contentRow] : []);
          }
          if (name === "family_voices") {
            return chain(state.voiceRow ? [state.voiceRow] : []);
          }
          return chain([]);
        },
      }),
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          state.insertCalls.push(v);
          return chain(state.insertClip ? [{ id: "clip-1" }] : []);
        },
      }),
      update: () => ({
        set: () => {
          state.updateCalls += 1;
          return chain([]);
        },
      }),
      delete: () => chain([]),
    },
  };
});

import { POST } from "@/app/api/clips/generate/route";

const req = (body: unknown) =>
  new Request("http://x/api/clips/generate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const validBody = { contentId: CONTENT_ID, voiceId: VOICE_ID };

const expectOrder = (...names: string[]) => {
  const idx = names.map((n) => order.indexOf(n));
  for (let i = 0; i < idx.length; i++) {
    expect(idx[i], `${names[i]} should have been called`).toBeGreaterThanOrEqual(0);
    if (i > 0) expect(idx[i], `${names[i]} after ${names[i - 1]}`).toBeGreaterThan(idx[i - 1]);
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  order.length = 0;
  state.contentRow = {
    textScript: "Once upon a time, a small seed grew.",
    contentMode: "tts",
    isolatedVocalsUrl: null,
    instrumentalUrl: "https://bg.example/track.mp3",
    originalVideoUrl: null,
  };
  state.voiceRow = {
    name: "Grandma",
    voiceOwnerName: "Grandma Example",
    providerVoiceId: "pv-1",
    rvcModelId: null,
  };
  state.insertClip = true;
  state.selectTables = [];
  state.insertCalls = [];
  state.updateCalls = 0;

  getUser.mockResolvedValue(USER);
  hasConsent.mockResolvedValue(true);
  paidRateLimit.mockResolvedValue(null);
  userRateLimit.mockResolvedValue(null);
  checkLimitMock.mockResolvedValue({ allowed: true });
  checkAbuseMock.mockReturnValue({ blocked: false });
  getCachedAudioMock.mockResolvedValue(null);
  generateSpeechMock.mockResolvedValue(Buffer.alloc(0));
  checkCostCapMock.mockResolvedValue({ allowed: true });
  recordUsageMock.mockResolvedValue(undefined);
  sendAlert.mockResolvedValue(undefined);
  getPresignedUploadUrlMock.mockResolvedValue("https://upload.example/put");

  // The background job downloads the instrumental and PUTs the mix
  // through global fetch — stub it so no network is ever touched.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/clips/generate — rejection ordering", () => {
  it("paid rate limit fires first: a 429 short-circuits before auth, consent, or any provider work", async () => {
    const { NextResponse } = await import("next/server");
    paidRateLimit.mockResolvedValue(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(429);
    expect(order).toEqual(["enforcePaidRateLimit"]);
    expect(hasConsent).not.toHaveBeenCalled();
    expect(generateSpeechMock).not.toHaveBeenCalled();
  });

  it("401 when unauthenticated — consent is never even checked", async () => {
    getUser.mockResolvedValue(null);
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(401);
    expectOrder("enforcePaidRateLimit", "getCurrentUser");
    expect(hasConsent).not.toHaveBeenCalled();
    expect(checkLimitMock).not.toHaveBeenCalled();
    expect(state.insertCalls).toHaveLength(0);
    expect(generateSpeechMock).not.toHaveBeenCalled();
  });

  it("403 consentRequired when consent is not active — before limits, cache, insert, or provider", async () => {
    hasConsent.mockResolvedValue(false);
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.consentRequired).toBe(true);
    expectOrder("getCurrentUser", "hasActiveConsent");
    expect(checkLimitMock).not.toHaveBeenCalled();
    expect(checkAbuseMock).not.toHaveBeenCalled();
    expect(getCachedAudioMock).not.toHaveBeenCalled();
    expect(state.insertCalls).toHaveLength(0);
    expect(generateSpeechMock).not.toHaveBeenCalled();
    expect(checkCostCapMock).not.toHaveBeenCalled();
  });

  it("400 on invalid input (non-UUID ids) after consent — before any limit or provider work", async () => {
    const res = await POST(req({ contentId: "nope", voiceId: "also-nope" }) as never);
    expect(res.status).toBe(400);
    expectOrder("hasActiveConsent");
    expect(userRateLimit).not.toHaveBeenCalled();
    expect(checkLimitMock).not.toHaveBeenCalled();
    expect(state.insertCalls).toHaveLength(0);
    expect(generateSpeechMock).not.toHaveBeenCalled();
  });

  it("400 on malformed JSON — after consent, before limits", async () => {
    const res = await POST(
      new Request("http://x/api/clips/generate", { method: "POST", body: "{broken" }) as never,
    );
    expect(res.status).toBe(400);
    expect(checkLimitMock).not.toHaveBeenCalled();
    expect(generateSpeechMock).not.toHaveBeenCalled();
  });

  it("per-user rate limit rejects before the plan limit check and any generation work", async () => {
    const { NextResponse } = await import("next/server");
    userRateLimit.mockResolvedValue(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(429);
    expectOrder("hasActiveConsent", "enforceUserRateLimit");
    expect(userRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", bucket: "clip_generate", limit: 20 }),
    );
    expect(checkLimitMock).not.toHaveBeenCalled();
    expect(state.insertCalls).toHaveLength(0);
    expect(generateSpeechMock).not.toHaveBeenCalled();
  });

  it("plan limit denial (403, upgradeRequired) rejects before abuse checks, cache, insert, or provider", async () => {
    checkLimitMock.mockResolvedValue({
      allowed: false,
      reason: "Video limit reached",
      upgradePrompt: "Upgrade to Family",
    });
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Video limit reached");
    expect(body.upgradeRequired).toBe(true);
    expect(checkLimitMock).toHaveBeenCalledWith("u1", "add_video");
    expectOrder("hasActiveConsent", "enforceUserRateLimit", "checkLimit");
    expect(checkAbuseMock).not.toHaveBeenCalled();
    expect(getCachedAudioMock).not.toHaveBeenCalled();
    expect(state.insertCalls).toHaveLength(0);
    expect(generateSpeechMock).not.toHaveBeenCalled();
    expect(checkCostCapMock).not.toHaveBeenCalled();
  });

  it("content-script abuse block (403) rejects before the cache lookup, insert, or provider", async () => {
    checkAbuseMock.mockReturnValue({ blocked: true, reason: "Celebrity impersonation", code: "celebrity" });
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("celebrity");
    expectOrder("checkLimit", "checkAbuse");
    expect(getCachedAudioMock).not.toHaveBeenCalled();
    expect(state.insertCalls).toHaveLength(0);
    expect(generateSpeechMock).not.toHaveBeenCalled();
  });

  it("404 when the content does not exist — no insert, no provider call", async () => {
    state.contentRow = null;
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(404);
    expect(getCachedAudioMock).not.toHaveBeenCalled();
    expect(state.insertCalls).toHaveLength(0);
    expect(generateSpeechMock).not.toHaveBeenCalled();
  });

  it("400 when a TTS story has no text script", async () => {
    state.contentRow = { ...state.contentRow, textScript: null };
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(400);
    expect(state.insertCalls).toHaveLength(0);
    expect(generateSpeechMock).not.toHaveBeenCalled();
  });

  it("400 when the story is missing its background music track", async () => {
    state.contentRow = { ...state.contentRow, instrumentalUrl: null };
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(400);
    expect(getCachedAudioMock).not.toHaveBeenCalled();
    expect(state.insertCalls).toHaveLength(0);
    expect(generateSpeechMock).not.toHaveBeenCalled();
  });

  it("500 when the clip record cannot be created — provider never called synchronously", async () => {
    state.insertClip = false;
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(500);
    expect(state.insertCalls).toHaveLength(1);
    expect(generateSpeechMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/clips/generate — happy paths", () => {
  it("serves a cached clip immediately: no insert and no provider call", async () => {
    getCachedAudioMock.mockResolvedValue("https://cdn.example/cached.mp3");
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ready", videoUrl: "https://cdn.example/cached.mp3", cached: true });
    expectOrder("checkLimit", "checkAbuse", "getCachedAudio");
    expect(state.insertCalls).toHaveLength(0);
    expect(generateSpeechMock).not.toHaveBeenCalled();
  });

  it("queues a clip for the session user after every gate passes", async () => {
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ clipId: "clip-1", status: "queued" });

    expectOrder(
      "enforcePaidRateLimit",
      "getCurrentUser",
      "hasActiveConsent",
      "enforceUserRateLimit",
      "checkLimit",
      "getCachedAudio",
    );
    expect(hasConsent).toHaveBeenCalledWith("u1");
    // The queued row belongs to the session user and the requested pair.
    expect(state.insertCalls).toEqual([
      { userId: "u1", contentId: CONTENT_ID, voiceId: VOICE_ID, status: "queued" },
    ]);
    // Stuck-clip cleanup update ran before/alongside creation.
    expect(state.updateCalls).toBeGreaterThanOrEqual(1);
  });

  it("background job checks the cost cap BEFORE calling the voice provider", async () => {
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(200);

    // Generation is fire-and-forget; wait for the background job to
    // reach the provider instead of asserting on the sync response.
    await vi.waitFor(() => expect(generateSpeechMock).toHaveBeenCalled(), { timeout: 10_000 });
    expect(checkCostCapMock).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ kind: "tts_chars" }),
    );
    expectOrder("checkCostCap", "generateSpeech");
    expect(generateSpeechMock).toHaveBeenCalledWith("pv-1", "Once upon a time, a small seed grew.");
    expectOrder("generateSpeech", "recordUsage");
    // Let the background job drain (upload + ready update) before teardown.
    await vi.waitFor(() => expect(state.updateCalls).toBeGreaterThanOrEqual(2), { timeout: 10_000 });
  });

  it("background job never calls the provider when the cost cap denies", async () => {
    checkCostCapMock.mockResolvedValue({ allowed: false, reason: "Cost cap reached" });
    const res = await POST(req(validBody) as never);
    expect(res.status).toBe(200); // queued synchronously; the cap bites in the job

    await vi.waitFor(() => expect(sendAlert).toHaveBeenCalled(), { timeout: 10_000 });
    expect(checkCostCapMock).toHaveBeenCalled();
    expect(generateSpeechMock).not.toHaveBeenCalled();
    expect(recordUsageMock).not.toHaveBeenCalled();
  });
});
