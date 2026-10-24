import { describe, it, expect, vi, beforeEach } from "vitest";

type UserRow = {
  plan: "free" | "family" | "premium";
  tts_chars_used: number;
  replicate_trainings_used: number;
  replicate_inferences_used: number;
} | null;

let fakeUser: UserRow = null;
const rpcCalls: Array<{ name: string; args: unknown }> = [];

// Phase 4: the RPCs are SQL functions called via Drizzle `db.execute(sql``)`.
// The mock decodes the SQL template (function name + positional params)
// back into the { name, args } shape these assertions were written
// against. The speech counter parameter is p_tts_chars.
vi.mock("../lib/db", () => {
  const decode = (query: unknown): { name: string; args: Record<string, unknown> } => {
    const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
    let text = "";
    const params: unknown[] = [];
    for (const chunk of chunks) {
      const kind = (chunk as object).constructor?.name;
      const value = (chunk as { value?: unknown }).value;
      if (kind === "StringChunk") {
        text += Array.isArray(value) ? value.join("") : String(value ?? "");
      } else if (kind === "Param") {
        params.push(value);
      } else if (typeof value === "string") {
        text += value;
      } else {
        params.push(value ?? chunk);
      }
    }
    const name = /select\s+(\w+)\s*\(/.exec(text)?.[1] ?? "unknown";
    const args: Record<string, unknown> =
      name === "reset_usage_if_stale"
        ? { p_user_id: params[0] }
        : {
            p_user_id: params[0],
            p_tts_chars: params[1],
            p_replicate_trainings: params[2],
            p_replicate_inferences: params[3],
          };
    return { name, args };
  };
  const selectChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit"]) chain[m] = () => chain;
    chain.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
      Promise.resolve(
        fakeUser
          ? [{
              plan: fakeUser.plan,
              ttsCharsUsed: fakeUser.tts_chars_used,
              replicateTrainingsUsed: fakeUser.replicate_trainings_used,
              replicateInferencesUsed: fakeUser.replicate_inferences_used,
            }]
          : [],
      ).then(res, rej);
    return chain;
  };
  return {
    db: {
      execute: (query: unknown) => {
        rpcCalls.push(decode(query));
        return Promise.resolve({ rows: [] });
      },
      select: () => selectChain(),
    },
  };
});

import { checkCostCap, recordUsage, COST_CAPS } from "../lib/cost-tracking";

beforeEach(() => {
  fakeUser = null;
  rpcCalls.length = 0;
});

describe("checkCostCap", () => {
  it("allows usage under the cap", async () => {
    fakeUser = {
      plan: "free",
      tts_chars_used: 0,
      replicate_trainings_used: 0,
      replicate_inferences_used: 0,
    };
    const result = await checkCostCap("u1", { kind: "tts_chars", chars: 100 });
    expect(result.allowed).toBe(true);
  });

  it("blocks when projected usage exceeds the cap", async () => {
    fakeUser = {
      plan: "free",
      tts_chars_used: COST_CAPS.free.ttsChars - 50,
      replicate_trainings_used: 0,
      replicate_inferences_used: 0,
    };
    const result = await checkCostCap("u1", { kind: "tts_chars", chars: 100 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/cap/i);
  });

  it("blocks training when at the per-plan cap", async () => {
    fakeUser = {
      plan: "free",
      tts_chars_used: 0,
      replicate_trainings_used: COST_CAPS.free.replicateTrainings,
      replicate_inferences_used: 0,
    };
    const result = await checkCostCap("u1", { kind: "replicate_training" });
    expect(result.allowed).toBe(false);
  });

  it("scales with plan tier", async () => {
    fakeUser = {
      plan: "premium",
      tts_chars_used: 1_000_000,
      replicate_trainings_used: 0,
      replicate_inferences_used: 0,
    };
    const result = await checkCostCap("u1", { kind: "tts_chars", chars: 500_000 });
    expect(result.allowed).toBe(true);
  });

  it("calls reset_usage_if_stale before reading usage", async () => {
    fakeUser = {
      plan: "free",
      tts_chars_used: 0,
      replicate_trainings_used: 0,
      replicate_inferences_used: 0,
    };
    await checkCostCap("u1", { kind: "replicate_inference" });
    expect(rpcCalls[0].name).toBe("reset_usage_if_stale");
    expect((rpcCalls[0].args as { p_user_id: string }).p_user_id).toBe("u1");
  });
});

describe("recordUsage", () => {
  it("increments only the relevant counter for tts_chars", async () => {
    await recordUsage("u1", { kind: "tts_chars", chars: 200 });
    const call = rpcCalls.find((c) => c.name === "increment_usage");
    expect(call).toBeDefined();
    expect(call!.args).toEqual({
      p_user_id: "u1",
      p_tts_chars: 200,
      p_replicate_trainings: 0,
      p_replicate_inferences: 0,
    });
  });

  it("increments only the relevant counter for replicate_training", async () => {
    await recordUsage("u1", { kind: "replicate_training" });
    const call = rpcCalls.find((c) => c.name === "increment_usage");
    expect(call!.args).toEqual({
      p_user_id: "u1",
      p_tts_chars: 0,
      p_replicate_trainings: 1,
      p_replicate_inferences: 0,
    });
  });

  it("increments only the relevant counter for replicate_inference", async () => {
    await recordUsage("u1", { kind: "replicate_inference" });
    const call = rpcCalls.find((c) => c.name === "increment_usage");
    expect(call!.args).toEqual({
      p_user_id: "u1",
      p_tts_chars: 0,
      p_replicate_trainings: 0,
      p_replicate_inferences: 1,
    });
  });
});

describe("COST_CAPS — sanity", () => {
  it("each higher tier is at least as permissive as the lower", () => {
    expect(COST_CAPS.family.ttsChars).toBeGreaterThanOrEqual(
      COST_CAPS.free.ttsChars
    );
    expect(COST_CAPS.premium.ttsChars).toBeGreaterThanOrEqual(
      COST_CAPS.family.ttsChars
    );
    expect(COST_CAPS.premium.replicateTrainings).toBeGreaterThanOrEqual(
      COST_CAPS.family.replicateTrainings
    );
  });
});
