import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the admin Supabase client BEFORE importing the module under test
type FakeUserRow = {
  plan: "free" | "family" | "premium";
  voice_slots_used: number;
  videos_used: number;
  stories_used: number;
} | null;

let fakeUser: FakeUserRow = null;
let fakeError: { message: string } | null = null;

vi.mock("../lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: fakeUser, error: fakeError }),
        }),
      }),
    }),
  }),
}));

import { checkLimit, PLAN_LIMITS, planLabel } from "../lib/limits";

beforeEach(() => {
  fakeUser = null;
  fakeError = null;
});

describe("checkLimit — voice slots", () => {
  it("free user under voice slot cap is allowed", async () => {
    fakeUser = { plan: "free", voice_slots_used: 0, videos_used: 0, stories_used: 0 };
    const result = await checkLimit("u1", "add_voice");
    expect(result.allowed).toBe(true);
  });

  it("free user at voice slot cap is blocked with upgrade prompt", async () => {
    fakeUser = { plan: "free", voice_slots_used: 1, videos_used: 0, stories_used: 0 };
    const result = await checkLimit("u1", "add_voice");
    expect(result.allowed).toBe(false);
    expect(result.upgradePrompt).toMatch(/Family/);
  });

  it("family user at voice slot cap is blocked and pointed to Premium", async () => {
    fakeUser = { plan: "family", voice_slots_used: 2, videos_used: 0, stories_used: 0 };
    const result = await checkLimit("u1", "add_voice");
    expect(result.allowed).toBe(false);
    expect(result.upgradePrompt).toMatch(/Premium/);
  });

  it("premium user has unlimited voice slots", async () => {
    fakeUser = { plan: "premium", voice_slots_used: 99, videos_used: 0, stories_used: 0 };
    const result = await checkLimit("u1", "add_voice");
    expect(result.allowed).toBe(true);
  });
});

describe("checkLimit — videos", () => {
  it("free user under video cap is allowed", async () => {
    fakeUser = { plan: "free", voice_slots_used: 0, videos_used: 1, stories_used: 0 };
    const result = await checkLimit("u1", "add_video");
    expect(result.allowed).toBe(true);
  });

  it("free user at video cap is blocked", async () => {
    fakeUser = { plan: "free", voice_slots_used: 0, videos_used: 2, stories_used: 0 };
    const result = await checkLimit("u1", "add_video");
    expect(result.allowed).toBe(false);
  });

  it("family user has unlimited videos", async () => {
    fakeUser = { plan: "family", voice_slots_used: 0, videos_used: 9999, stories_used: 0 };
    const result = await checkLimit("u1", "add_video");
    expect(result.allowed).toBe(true);
  });
});

describe("checkLimit — stories", () => {
  it("free user at story cap is blocked", async () => {
    fakeUser = { plan: "free", voice_slots_used: 0, videos_used: 0, stories_used: 4 };
    const result = await checkLimit("u1", "add_story");
    expect(result.allowed).toBe(false);
  });

  it("premium user has unlimited stories", async () => {
    fakeUser = { plan: "premium", voice_slots_used: 0, videos_used: 0, stories_used: 9999 };
    const result = await checkLimit("u1", "add_story");
    expect(result.allowed).toBe(true);
  });
});

describe("checkLimit — premium content", () => {
  it("free user cannot access premium content", async () => {
    fakeUser = { plan: "free", voice_slots_used: 0, videos_used: 0, stories_used: 0 };
    const result = await checkLimit("u1", "premium_content");
    expect(result.allowed).toBe(false);
  });

  it("family user can access premium content", async () => {
    fakeUser = { plan: "family", voice_slots_used: 0, videos_used: 0, stories_used: 0 };
    const result = await checkLimit("u1", "premium_content");
    expect(result.allowed).toBe(true);
  });
});

describe("checkLimit — missing user", () => {
  it("returns disallowed when DB returns an error", async () => {
    fakeError = { message: "row not found" };
    const result = await checkLimit("missing", "add_voice");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("User not found");
  });
});

describe("planLabel", () => {
  it("returns Free for null/undefined", () => {
    expect(planLabel(null)).toBe("Free");
    expect(planLabel(undefined)).toBe("Free");
  });

  it("maps each plan to its display label", () => {
    expect(planLabel("free")).toBe("Free");
    expect(planLabel("family")).toBe("Family");
    expect(planLabel("premium")).toBe("Premium");
  });
});

describe("PLAN_LIMITS — sanity", () => {
  it("each higher tier is at least as permissive as the lower", () => {
    expect(PLAN_LIMITS.family.voice_slots).toBeGreaterThanOrEqual(
      PLAN_LIMITS.free.voice_slots
    );
    expect(PLAN_LIMITS.premium.voice_slots).toBeNull();
    expect(PLAN_LIMITS.family.videos).toBeNull();
    expect(PLAN_LIMITS.premium.videos).toBeNull();
  });
});
