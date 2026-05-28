import { describe, it, expect, vi, beforeEach } from "vitest";

type UserRow = {
  plan: "free" | "family" | "premium";
  elevenlabs_chars_used: number;
  replicate_trainings_used: number;
  replicate_inferences_used: number;
} | null;

let fakeUser: UserRow = null;
const rpcCalls: Array<{ name: string; args: unknown }> = [];

vi.mock("../lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: null, error: null });
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: fakeUser, error: null }),
        }),
      }),
    }),
  }),
}));

import { checkCostCap, recordUsage, COST_CAPS } from "../lib/cost-tracking";

beforeEach(() => {
  fakeUser = null;
  rpcCalls.length = 0;
});

describe("checkCostCap", () => {
  it("allows usage under the cap", async () => {
    fakeUser = {
      plan: "free",
      elevenlabs_chars_used: 0,
      replicate_trainings_used: 0,
      replicate_inferences_used: 0,
    };
    const result = await checkCostCap("u1", { kind: "elevenlabs_chars", chars: 100 });
    expect(result.allowed).toBe(true);
  });

  it("blocks when projected usage exceeds the cap", async () => {
    fakeUser = {
      plan: "free",
      elevenlabs_chars_used: COST_CAPS.free.elevenlabsChars - 50,
      replicate_trainings_used: 0,
      replicate_inferences_used: 0,
    };
    const result = await checkCostCap("u1", { kind: "elevenlabs_chars", chars: 100 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/cap/i);
  });

  it("blocks training when at the per-plan cap", async () => {
    fakeUser = {
      plan: "free",
      elevenlabs_chars_used: 0,
      replicate_trainings_used: COST_CAPS.free.replicateTrainings,
      replicate_inferences_used: 0,
    };
    const result = await checkCostCap("u1", { kind: "replicate_training" });
    expect(result.allowed).toBe(false);
  });

  it("scales with plan tier", async () => {
    fakeUser = {
      plan: "premium",
      elevenlabs_chars_used: 1_000_000,
      replicate_trainings_used: 0,
      replicate_inferences_used: 0,
    };
    const result = await checkCostCap("u1", { kind: "elevenlabs_chars", chars: 500_000 });
    expect(result.allowed).toBe(true);
  });

  it("calls reset_usage_if_stale before reading usage", async () => {
    fakeUser = {
      plan: "free",
      elevenlabs_chars_used: 0,
      replicate_trainings_used: 0,
      replicate_inferences_used: 0,
    };
    await checkCostCap("u1", { kind: "replicate_inference" });
    expect(rpcCalls[0].name).toBe("reset_usage_if_stale");
    expect((rpcCalls[0].args as { p_user_id: string }).p_user_id).toBe("u1");
  });
});

describe("recordUsage", () => {
  it("increments only the relevant counter for elevenlabs_chars", async () => {
    await recordUsage("u1", { kind: "elevenlabs_chars", chars: 200 });
    const call = rpcCalls.find((c) => c.name === "increment_usage");
    expect(call).toBeDefined();
    expect(call!.args).toEqual({
      p_user_id: "u1",
      p_elevenlabs_chars: 200,
      p_replicate_trainings: 0,
      p_replicate_inferences: 0,
    });
  });

  it("increments only the relevant counter for replicate_training", async () => {
    await recordUsage("u1", { kind: "replicate_training" });
    const call = rpcCalls.find((c) => c.name === "increment_usage");
    expect(call!.args).toEqual({
      p_user_id: "u1",
      p_elevenlabs_chars: 0,
      p_replicate_trainings: 1,
      p_replicate_inferences: 0,
    });
  });

  it("increments only the relevant counter for replicate_inference", async () => {
    await recordUsage("u1", { kind: "replicate_inference" });
    const call = rpcCalls.find((c) => c.name === "increment_usage");
    expect(call!.args).toEqual({
      p_user_id: "u1",
      p_elevenlabs_chars: 0,
      p_replicate_trainings: 0,
      p_replicate_inferences: 1,
    });
  });
});

describe("COST_CAPS — sanity", () => {
  it("each higher tier is at least as permissive as the lower", () => {
    expect(COST_CAPS.family.elevenlabsChars).toBeGreaterThanOrEqual(
      COST_CAPS.free.elevenlabsChars
    );
    expect(COST_CAPS.premium.elevenlabsChars).toBeGreaterThanOrEqual(
      COST_CAPS.family.elevenlabsChars
    );
    expect(COST_CAPS.premium.replicateTrainings).toBeGreaterThanOrEqual(
      COST_CAPS.family.replicateTrainings
    );
  });
});
