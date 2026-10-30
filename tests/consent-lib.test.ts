import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

import { hasActiveConsent, getConsentHashSalt } from "@/lib/consent";

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

describe("getConsentHashSalt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("prefers CONSENT_HASH_SALT over AUTH_SECRET", () => {
    vi.stubEnv("CONSENT_HASH_SALT", "dedicated-salt");
    vi.stubEnv("AUTH_SECRET", "auth-secret-value");
    expect(getConsentHashSalt()).toBe("dedicated-salt");
  });
  it("falls back to AUTH_SECRET", () => {
    vi.stubEnv("CONSENT_HASH_SALT", "");
    // stubEnv with "" sets the var; delete semantics differ, so unset via delete
    delete process.env.CONSENT_HASH_SALT;
    vi.stubEnv("AUTH_SECRET", "auth-secret-value");
    expect(getConsentHashSalt()).toBe("auth-secret-value");
  });
  it("uses the development fallback outside production", () => {
    delete process.env.CONSENT_HASH_SALT;
    delete process.env.AUTH_SECRET;
    vi.stubEnv("NODE_ENV", "test");
    expect(getConsentHashSalt()).toBe("development-only");
  });
  it("fails closed in production when neither salt nor secret is set", () => {
    delete process.env.CONSENT_HASH_SALT;
    delete process.env.AUTH_SECRET;
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getConsentHashSalt()).toThrow(/CONSENT_HASH_SALT/);
  });
});
