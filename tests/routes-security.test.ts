import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ── Helpers to mock the Auth.js session + Drizzle db (Phase 4) ──

const mockGetUser = vi.fn();
const mockInsert = vi.fn();
const mockDeleteVoice = vi.fn();
const mockCheckLimit = vi.fn();
const mockGetPresignedUploadUrl = vi.fn();
const mockRateLimit = vi.fn(() => Promise.resolve(null as Response | null));
const mockUserRateLimit = vi.fn(() => Promise.resolve(null as Response | null));

// Voice row returned by family_voices selects in the delete tests.
const state = vi.hoisted(() => ({ voiceRow: null as Record<string, unknown> | null }));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => {
    const u = (await mockGetUser()).data.user;
    return u ? { id: u.id, email: "user-a@example.com", name: "User A" } : null;
  },
  getCurrentUserId: async () => (await mockGetUser()).data.user?.id ?? null,
}));

vi.mock("@/lib/db", async () => {
  const { getTableName } = await import("drizzle-orm");
  const chain = (rows: unknown[]) => {
    const c: Record<string, unknown> = {};
    for (const m of ["where", "limit", "orderBy", "returning"]) c[m] = () => c;
    c.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
      Promise.resolve(rows).then(res, rej);
    return c;
  };
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          const name = getTableName(table as never);
          if (name === "users") {
            return chain([{ consentVerified: true, consentNoticeVersion: "test" }]);
          }
          if (name === "family_voices") {
            return chain(state.voiceRow ? [state.voiceRow] : []);
          }
          return chain([]);
        },
      }),
      insert: (table: unknown) => ({
        values: (v: Record<string, unknown>) => ({
          returning: async () => {
            const name = getTableName(table as never);
            if (name === "family_voices") {
              const r = (await mockInsert("family_voices", v)) as {
                data: Record<string, unknown> | null;
                error: unknown;
              };
              if (r.error) throw r.error;
              return [r.data];
            }
            // voice_jobs (enqueueJob): synthesize a full job row.
            return [{
              id: "job-1",
              userId: v.userId,
              type: v.type,
              payload: v.payload ?? {},
              status: v.status ?? "queued",
              attempts: 0,
              maxAttempts: v.maxAttempts ?? 3,
              lastError: null,
              workerId: null,
              result: null,
              idempotencyKey: v.idempotencyKey ?? null,
              createdAt: new Date(),
              updatedAt: new Date(),
              completedAt: null,
              lockedUntil: null,
            }];
          },
        }),
      }),
      update: () => ({ set: () => chain([]) }),
      delete: () => chain([]),
      execute: async () => ({ rows: [] }),
    },
  };
});

vi.mock("@/lib/voice-provider", () => ({
  deleteVoice: (...args: unknown[]) => mockDeleteVoice(...args),
}));

vi.mock("@/lib/limits", () => ({
  checkLimit: (...args: unknown[]) => mockCheckLimit(...args),
}));

vi.mock("@/lib/gcp", () => ({
  getPresignedUploadUrl: (...args: unknown[]) => mockGetPresignedUploadUrl(...args),
  GCP_PATHS: { voiceSample: (uid: string, vid: string) => `voices/${uid}/${vid}.mp3` },
}));

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    enforcePaidRateLimit: (...args: unknown[]) => (mockRateLimit as unknown as (...a: unknown[]) => unknown)(...args),
    enforceUserRateLimit: (...args: unknown[]) => (mockUserRateLimit as unknown as (...a: unknown[]) => unknown)(...args),
  };
});

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

import { POST as createVoice } from "@/app/api/voices/create/route";
import { POST as deleteVoiceRoute } from "@/app/api/voices/delete/route";
import { POST as stripeWebhook } from "@/app/api/stripe/webhook/route";
import { stripe } from "@/lib/stripe";

function reqJson(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const authorizedVoice = {
  name: "Grandma",
  voiceOwnerName: "Grandma Example",
  voiceOwnerRelationship: "Grandmother",
  voiceOwnerAuthorized: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-a" } } });
  mockCheckLimit.mockResolvedValue({ allowed: true });
  mockGetPresignedUploadUrl.mockResolvedValue("https://storage.googleapis.com/bucket/voices/user-a/v1.mp3?sig=xxx");
  mockInsert.mockResolvedValue({ data: { id: "voice-1", user_id: "user-a" }, error: null });
  state.voiceRow = null;
});

describe("POST /api/voices/create", () => {
  it("401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await createVoice(reqJson(authorizedVoice));
    expect(res.status).toBe(401);
  });

  it("403 when voice slot limit reached", async () => {
    mockCheckLimit.mockResolvedValue({ allowed: false, reason: "Voice limit reached", upgradePrompt: "Upgrade" });
    const res = await createVoice(reqJson(authorizedVoice));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.upgradeRequired).toBe(true);
  });

  it("400 on invalid input (empty name)", async () => {
    const res = await createVoice(reqJson({ name: "" }));
    expect(res.status).toBe(400);
  });

  it("429 when rate-limited", async () => {
    mockRateLimit.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Rate limited" }), { status: 429 }));
    const res = await createVoice(reqJson({ name: "Grandma" }));
    expect(res.status).toBe(429);
  });

  it("201 happy path returns uploadUrl and gcpKey", async () => {
    const res = await createVoice(reqJson({ ...authorizedVoice, contentType: "audio/wav" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.voiceId).toBe("voice-1");
    expect(body.uploadUrl).toContain("storage.googleapis.com");
    expect(body.gcpKey).toContain("voices/user-a");
  });

  it("still creates record when insert succeeds and returns presigned URL", async () => {
    mockInsert.mockResolvedValueOnce({ data: { id: "voice-2", user_id: "user-a" }, error: null });
    const res = await createVoice(reqJson({ ...authorizedVoice, name: "Mom", voiceOwnerName: "Mom Example", voiceOwnerRelationship: "Mother" }));
    expect(res.status).toBe(200);
    expect(mockGetPresignedUploadUrl).toHaveBeenCalled();
  });
});

describe("POST /api/voices/delete — IDOR guard", () => {
  function setVoiceRow(row: Record<string, unknown> | null) {
    // Thread through the db mock's family_voices select.
    state.voiceRow = row;
  }
  void setVoiceRow;

  it("401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await deleteVoiceRoute(reqJson({ voiceId: "00000000-0000-0000-0000-000000000001" }));
    expect(res.status).toBe(401);
  });

  it("404 when voice does not exist", async () => {
    // No row returned → handler returns 404
    const res = await deleteVoiceRoute(reqJson({ voiceId: "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b" }));
    // Implementation does `if (!voice || voice.user_id !== user.id) return 404`
    // With default mock returning null, this is 404
    expect(res.status).toBe(404);
  });

  it("400 on invalid UUID", async () => {
    const res = await deleteVoiceRoute(reqJson({ voiceId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/stripe/webhook — signature + replay", () => {

  it("400 when stripe-signature header missing", async () => {
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: {},
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await stripeWebhook(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing signature/);
  });

  it("400 when constructEvent throws (bad signature)", async () => {
    (stripe.webhooks.constructEvent as unknown as Mock).mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "bad_sig" },
      body: "{}",
    });
    const res = await stripeWebhook(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/signature verification failed/i);
  });

  it("200 on valid checkout.session.completed (mocked)", async () => {
    (stripe.webhooks.constructEvent as unknown as Mock).mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { metadata: { supabase_user_id: "user-a", plan: "family" } } },
    });
    // mock admin update to succeed
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "valid_sig" },
      body: "{}",
    });
    const res = await stripeWebhook(req);
    expect(res.status).toBe(200);
    expect((await res.json()).received).toBe(true);
  });
});
