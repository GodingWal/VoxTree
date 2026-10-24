import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/password";

/**
 * Phase 3 (local-stack migration) — Credentials passwords are bcrypt hashes
 * in `users.password_hash`, verified by the Auth.js Credentials
 * provider's authorize() in lib/auth/index.ts.
 */
describe("auth password hashing", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse");
    await expect(
      verifyPassword("correct horse battery staple", hash),
    ).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("salts: two hashes of the same password differ", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same-password"),
      hashPassword("same-password"),
    ]);
    expect(a).not.toBe(b);
  });
});
