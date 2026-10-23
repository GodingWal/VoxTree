import { describe, it, expect, vi, beforeEach } from "vitest";

let userRow: { consent_verified: boolean } | null = { consent_verified: true };
let record: { id: string } | null = { id: "c1" };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "not", "limit"]) chain[m] = () => chain;
      chain.single = () => Promise.resolve({ data: userRow, error: userRow ? null : new Error("x") });
      chain.maybeSingle = () => Promise.resolve({ data: table === "consent_records" ? record : null });
      return chain;
    },
  }),
}));

import { hasActiveConsent } from "@/lib/consent";

describe("hasActiveConsent", () => {
  beforeEach(() => {
    userRow = { consent_verified: true };
    record = { id: "c1" };
  });
  it("allows verified users with an adult-attested, unrevoked record", async () => {
    expect(await hasActiveConsent("u")).toBe(true);
  });
  it("rejects legacy users whose consent has no adult attestation", async () => {
    record = null;
    expect(await hasActiveConsent("u")).toBe(false);
  });
  it("rejects users whose flag is off", async () => {
    userRow = { consent_verified: false };
    expect(await hasActiveConsent("u")).toBe(false);
  });
});
