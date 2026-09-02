import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Limits / Features unit tests (no mocks needed for constants) ──
import { TRIAL_CLIPS_LIMIT, TRIAL_CLIP_MAX_DURATION_SEC, TRIAL_LIMITS, PLAN_LIMITS, isTrialClipAllowed, trialClipsRemaining } from "@/lib/limits";
import { TRIAL_WATERMARK, TRIAL_WATERMARK_TEXT, TRIAL_WATERMARK_ENABLED, isTrialWatermarkEnabled, shouldApplyTrialWatermark } from "@/lib/features";

describe("Trial limits", () => {
  it("exports TRIAL_CLIPS_LIMIT = 3", () => {
    expect(TRIAL_CLIPS_LIMIT).toBe(3);
  });

  it("exports TRIAL_CLIP_MAX_DURATION_SEC = 30", () => {
    expect(TRIAL_CLIP_MAX_DURATION_SEC).toBe(30);
  });

  it("TRIAL_LIMITS has trialClips 3", () => {
    expect(TRIAL_LIMITS.trialClips).toBe(3);
    expect(TRIAL_LIMITS.maxDurationSec).toBe(30);
    expect(TRIAL_LIMITS.watermark).toBe(true);
  });

  it("PLAN_LIMITS.free has trialClips:3 and voice_slots 1", () => {
    expect(PLAN_LIMITS.free.trialClips).toBe(3);
    expect(PLAN_LIMITS.free.voice_slots).toBe(1);
  });

  it("isTrialClipAllowed true when <3", () => {
    expect(isTrialClipAllowed(0)).toBe(true);
    expect(isTrialClipAllowed(2)).toBe(true);
    expect(isTrialClipAllowed(3)).toBe(false);
    expect(isTrialClipAllowed(10)).toBe(false);
  });

  it("trialClipsRemaining computes correctly", () => {
    expect(trialClipsRemaining(0)).toBe(3);
    expect(trialClipsRemaining(1)).toBe(2);
    expect(trialClipsRemaining(3)).toBe(0);
    expect(trialClipsRemaining(5)).toBe(0);
  });
});

describe("Trial watermark feature", () => {
  it("exports TRIAL_WATERMARK constants", () => {
    expect(TRIAL_WATERMARK).toBe("TRIAL_WATERMARK");
    expect(TRIAL_WATERMARK_TEXT).toBe("VoxTree Trial");
    expect(TRIAL_WATERMARK_ENABLED).toBe(true);
    expect(isTrialWatermarkEnabled()).toBe(true);
  });

  it("shouldApplyTrialWatermark: trial && clips <3 => true else false", () => {
    expect(shouldApplyTrialWatermark({ isTrial: true, clipsUsed: 0 })).toBe(true);
    expect(shouldApplyTrialWatermark({ isTrial: true, clipsUsed: 2 })).toBe(true);
    expect(shouldApplyTrialWatermark({ isTrial: true, clipsUsed: 3 })).toBe(false);
    expect(shouldApplyTrialWatermark({ isTrial: false, clipsUsed: 0 })).toBe(false);
    expect(shouldApplyTrialWatermark({ isTrial: false, clipsUsed: 2 })).toBe(false);
  });

  it("respects custom trialLimit", () => {
    expect(shouldApplyTrialWatermark({ isTrial: true, clipsUsed: 3, trialLimit: 5 })).toBe(true);
    expect(shouldApplyTrialWatermark({ isTrial: true, clipsUsed: 5, trialLimit: 5 })).toBe(false);
  });
});

// ── Stripe checkout trial conversion ──
const mockGetUser = vi.fn();
const mockSelectProfile = vi.fn();
const mockUpdateProfile = vi.fn();
const mockCustomersCreate = vi.fn();
const mockSessionsCreate = vi.fn();

vi.mock("@/lib/supabase/auth", () => ({
  getRouteClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              single: () => mockSelectProfile(),
            }),
          }),
          update: () => ({
            eq: () => mockUpdateProfile(),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) };
    },
  }),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: (...args: unknown[]) => mockCustomersCreate(...args) },
    checkout: { sessions: { create: (...args: unknown[]) => mockSessionsCreate(...args) } },
  },
}));

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    safeJson: (req: Request) => req.json().then((body) => ({ body })).catch(() => ({ error: new Response(JSON.stringify({ error: "bad json" }), { status: 400 }) })),
  };
});

import { POST as checkoutPOST } from "@/app/api/stripe/checkout/route";

function reqJson(body: unknown) {
  return new Request("http://localhost/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/stripe/checkout — trial conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-trial", email: "trial@test.com" } } });
    mockSelectProfile.mockResolvedValue({ data: { stripe_customer_id: "cus_123" } });
    mockCustomersCreate.mockResolvedValue({ id: "cus_new" });
    mockSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session_test" });
    mockUpdateProfile.mockResolvedValue({ error: null });
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.STRIPE_FAMILY_MONTHLY_PRICE_ID = "price_family_monthly_test";
    process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID = "price_premium_monthly_test";
    process.env.STRIPE_FAMILY_ANNUAL_PRICE_ID = "price_family_annual_test";
    process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID = "price_premium_annual_test";
  });

  it("passes trial metadata when trial:true", async () => {
    const res = await checkoutPOST(reqJson({ plan: "family", billing: "monthly", trial: true }));
    expect(res.status).toBe(200);
    expect(mockSessionsCreate).toHaveBeenCalledTimes(1);
    const args = mockSessionsCreate.mock.calls[0][0] as any;
    expect(args.metadata.trial).toBe("true");
    expect(args.metadata.trial_conversion).toBe("true");
    expect(args.metadata.trial_source).toBe("try_before_you_pay");
    expect(args.success_url).toContain("trial_converted=true");
    const body = await res.json();
    expect(body.trial).toBe(true);
    expect(body.url).toBe("https://checkout.stripe.com/session_test");
  });

  it("passes trial metadata when isTrial:true alias", async () => {
    const res = await checkoutPOST(reqJson({ plan: "premium", billing: "annual", isTrial: true }));
    expect(mockSessionsCreate).toHaveBeenCalled();
    const args = mockSessionsCreate.mock.calls[0][0] as any;
    expect(args.metadata.trial).toBe("true");
    expect(await res.json()).toMatchObject({ trial: true });
  });

  it("no trial metadata when trial not set", async () => {
    const res = await checkoutPOST(reqJson({ plan: "family", billing: "monthly" }));
    const args = mockSessionsCreate.mock.calls[0][0] as any;
    expect(args.metadata.trial).toBeUndefined();
    expect(args.success_url).not.toContain("trial_converted");
    const body = await res.json();
    expect(body.trial).toBe(false);
  });

  it("cancel_url includes ?trial=true when trial conversion", async () => {
    await checkoutPOST(reqJson({ plan: "family", billing: "monthly", trial: true }));
    const args = mockSessionsCreate.mock.calls[0][0] as any;
    expect(args.cancel_url).toContain("trial=true");
  });

  it("creates stripe customer if missing and handles trial", async () => {
    mockSelectProfile.mockResolvedValue({ data: { stripe_customer_id: null } });
    mockCustomersCreate.mockResolvedValue({ id: "cus_created" });
    const res = await checkoutPOST(reqJson({ plan: "family", billing: "monthly", trial: true }));
    expect(mockCustomersCreate).toHaveBeenCalledWith(expect.objectContaining({ email: "trial@test.com" }));
    expect(mockSessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_created" }));
    expect((await res.json()).url).toBeDefined();
  });
});

// ── Clips generate trial watermark behavior (unit helper) ──
describe("Clip generate trial logic — watermark decision", () => {
  // Mirrors the route's decision: if user.trial && clips <3 add watermark else require Pro
  function trialClipDecision(userTrial: boolean, clips: number) {
    if (userTrial && clips < TRIAL_CLIPS_LIMIT) return { watermark: TRIAL_WATERMARK, duration: TRIAL_CLIP_MAX_DURATION_SEC, allowed: true };
    if (userTrial && clips >= TRIAL_CLIPS_LIMIT) return { allowed: false, upgradeRequired: true };
    return { allowed: true, watermark: undefined };
  }

  it("trial user with 0 clips gets watermark", () => {
    const d = trialClipDecision(true, 0);
    expect(d.allowed).toBe(true);
    expect(d.watermark).toBe(TRIAL_WATERMARK);
    expect(d.duration).toBe(30);
  });

  it("trial user with 2 clips gets watermark", () => {
    const d = trialClipDecision(true, 2);
    expect(d.watermark).toBe(TRIAL_WATERMARK);
  });

  it("trial user with 3 clips is blocked and requires Pro", () => {
    const d = trialClipDecision(true, 3);
    expect(d.allowed).toBe(false);
    expect((d as any).upgradeRequired).toBe(true);
  });

  it("non-trial user is not watermarked", () => {
    const d = trialClipDecision(false, 0);
    expect(d.watermark).toBeUndefined();
    expect(d.allowed).toBe(true);
  });

  it("trial edge: exactly at limit requires Pro", () => {
    expect(trialClipDecision(true, 3).allowed).toBe(false);
    expect(trialClipDecision(true, 4).allowed).toBe(false);
  });
});
