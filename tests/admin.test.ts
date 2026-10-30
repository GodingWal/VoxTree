import { describe, it, expect } from "vitest";

import { isAdmin } from "../lib/admin";

// No database mock on purpose: after the simplification, isAdmin is
// allowlist-only and must not touch the db at all (the old `role`
// column fallback queried a column that does not exist in the schema).
describe("isAdmin (allowlist only)", () => {
  it("returns true for the allowlisted email", async () => {
    await expect(isAdmin("gwal325@gmail.com")).resolves.toBe(true);
  });

  it("is case-insensitive for the allowlisted email", async () => {
    await expect(isAdmin("GWAL325@GMAIL.COM")).resolves.toBe(true);
    await expect(isAdmin("Gwal325@Gmail.Com")).resolves.toBe(true);
  });

  it("returns false for a non-allowlist email", async () => {
    await expect(isAdmin("someone-else@example.com")).resolves.toBe(false);
    await expect(isAdmin("gwal325@example.com")).resolves.toBe(false);
  });

  it("returns false for null, undefined, and empty email", async () => {
    await expect(isAdmin(null)).resolves.toBe(false);
    await expect(isAdmin(undefined)).resolves.toBe(false);
    await expect(isAdmin("")).resolves.toBe(false);
  });
});
