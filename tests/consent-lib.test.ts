import { describe, it, expect, vi, beforeEach } from "vitest";

let userRow: { consent_verified: boolean } | null = { consent_verified: true };
let record: { id: string } | null = { id: "c1" };

// Phase 4: lib/consent reads through Drizzle (lib/db). Mock that surface:
// select chains resolve camelCase rows — users first, then consent_records.
vi.mock("@/lib/db", async () => {
  const { getTableName } = await import("drizzle-orm");
  const { users } = await import("@/lib/db/schema");
  const chain = (rows: unknown[]) => {
    const c: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit"]) c[m] = () => c;
    c.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
      Promise.resolve(rows).then(res, rej);
    return c;
  };
  return {
    db: {
      select: () => ({
        from: (table: unknown) =>
          getTableName(table as never) === getTableName(users)
            ? chain(userRow ? [{ consentVerified: userRow.consent_verified }] : [])
            : chain(record ? [{ id: record.id }] : []),
      }),
    },
  };
});

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
