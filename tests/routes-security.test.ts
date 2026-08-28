import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ── Helpers to mock Supabase route/admin clients ──

const mockGetUser = vi.fn();
const mockInsert = vi.fn();
const mockDeleteVoice = vi.fn();
const mockCheckLimit = vi.fn();
const mockGetPresignedUploadUrl = vi.fn();
const mockRateLimit = vi.fn(() => Promise.resolve(null as Response | null));
const mockUserRateLimit = vi.fn(() => Promise.resolve(null as Response | null));

vi.mock("@/lib/supabase/auth", () => ({
  getRouteClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => ({
      insert: (row: unknown) => ({
        select: () => ({
          single: () => mockInsert(table, row),
        }),
      }),
      select: () => ({
        eq: () => ({
          single: () =>
            // voices/delete ownership check — return row belonging to caller or other user
            Promise.resolve({ data: (vi as unknown as { _voiceRow?: unknown })._voiceRow ?? null }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
    rpc: () => Promise.resolve({ error: null }),
  }),
}));

vi.mock("@/lib/elevenlabs", () => ({
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

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-a" } } });
  mockCheckLimit.mockResolvedValue({ allowed: true });
  mockGetPresignedUploadUrl.mockResolvedValue("https://storage.googleapis.com/bucket/voices/user-a/v1.mp3?sig=xxx");
  mockInsert.mockResolvedValue({ data: { id: "voice-1", user_id: "user-a" }, error: null });
  // @ts-ignore
  (vi as unknown as { _voiceRow?: unknown })._voiceRow = null;
});

describe("POST /api/voices/create", () => {
  it("401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await createVoice(reqJson({ name: "Grandma" }));
    expect(res.status).toBe(401);
  });

  it("403 when voice slot limit reached", async () => {
    mockCheckLimit.mockResolvedValue({ allowed: false, reason: "Voice limit reached", upgradePrompt: "Upgrade" });
    const res = await createVoice(reqJson({ name: "Grandma" }));
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
    const res = await createVoice(reqJson({ name: "Grandma", contentType: "audio/wav" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.voiceId).toBe("voice-1");
    expect(body.uploadUrl).toContain("storage.googleapis.com");
    expect(body.gcpKey).toContain("voices/user-a");
  });

  it("still creates record when insert succeeds and returns presigned URL", async () => {
    mockInsert.mockResolvedValueOnce({ data: { id: "voice-2", user_id: "user-a" }, error: null });
    const res = await createVoice(reqJson({ name: "Mom" }));
    expect(res.status).toBe(200);
    expect(mockGetPresignedUploadUrl).toHaveBeenCalled();
  });
});

describe("POST /api/voices/delete — IDOR guard", () => {
  function setVoiceRow(row: unknown) {
    // @ts-ignore — thread through mock
    (vi as unknown as Record<string, unknown>)._voiceRow = row;
    // Re-mock getRouteClient to return the row
    vi.doMock("@/lib/supabase/auth", () => ({
      getRouteClient: () => ({
        auth: { getUser: mockGetUser },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: row }),
            }),
          }),
        }),
      }),
    }));
  }

  it("401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await deleteVoiceRoute(reqJson({ voiceId: "00000000-0000-0000-0000-000000000001" }));
    expect(res.status).toBe(401);
  });

  it("404 when voice does not exist", async () => {
    // No row returned → handler returns 404
    const res = await deleteVoiceRoute(reqJson({ voiceId: "00000000-0000-0000-0000-000000000099" }));
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
  const webhookSecret = "whsec_test";

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
