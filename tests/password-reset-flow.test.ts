import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

/**
 * Route/lib-level tests for lib/auth/password-reset.ts — the token
 * issue/consume/expiry flow (tests/auth-password.test.ts only covers
 * the bcrypt helpers).
 *
 * Real semantics pinned here (read from the implementation):
 * - requestPasswordReset() lowercases/trims the email, looks the user
 *   up, deletes any previous token row for `password-reset:<email>`,
 *   inserts a NEW row whose `token` column is the SHA-256 hex of a
 *   32-byte random raw token (the raw token itself is never stored),
 *   with `expires` ~1 hour out, and emails a reset URL carrying the
 *   RAW token. Unknown/empty emails resolve silently (no enumeration).
 * - consumePasswordReset() rejects passwords < 6 chars up front,
 *   selects a token row matching identifier + SHA-256(token) +
 *   expires > now, BURNS that row before updating the password
 *   (single-use), then bcrypt-hashes the new password onto the users
 *   row and returns whether a user row was updated.
 *
 * The db mock is a small in-memory analogue of the Drizzle chain:
 * selects filter the stored token rows by the actual Param values
 * bound in the where clause (identifier / token hash / expiry bound),
 * exactly as Postgres would.
 */

const sendEmail = vi.fn();

const USER_EMAIL = "user@example.com";

const state = vi.hoisted(() => ({
  tokens: [] as Array<{ identifier: string; token: string; expires: Date }>,
  userExists: true,
  updateReturnsRow: true,
  insertedTokens: [] as Array<{ identifier: string; token: string; expires: Date }>,
  passwordUpdates: [] as Array<{ passwordHash: unknown; params: unknown[] }>,
  tokenDeletes: [] as unknown[][],
  selectCount: 0,
}));

/** Recursively collect Drizzle `Param` values bound in a where clause, in order. */
function paramsOf(cond: unknown): unknown[] {
  const out: unknown[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const c = node as { queryChunks?: unknown[]; value?: unknown };
    if ((node as object).constructor?.name === "Param") {
      out.push(c.value);
      return;
    }
    if (Array.isArray(c.queryChunks)) c.queryChunks.forEach(walk);
  };
  walk(cond);
  return out;
}

vi.mock("@/lib/email", () => ({
  sendTransactionalEmail: (...a: unknown[]) => sendEmail(...a),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/db", async () => {
  const { getTableName } = await import("drizzle-orm");

  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit", "values", "set", "returning"]) c[m] = () => c;
    c.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
      Promise.resolve(result).then(res, rej);
    return c;
  };

  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          const name = getTableName(table as never);
          const c: Record<string, unknown> = {};
          let result: unknown[] = [];
          c.where = (cond: unknown) => {
            state.selectCount += 1;
            const params = paramsOf(cond);
            if (name === "users") {
              result =
                state.userExists && params.includes(USER_EMAIL)
                  ? [{ id: "u1", name: "Test User" }]
                  : [];
            } else if (name === "verification_tokens") {
              const [identifier, tokenHash, bound] = params as [string, string, unknown];
              const boundDate = bound instanceof Date ? bound : new Date(bound as string);
              result = state.tokens.filter(
                (t) =>
                  t.identifier === identifier &&
                  t.token === tokenHash &&
                  t.expires.getTime() > boundDate.getTime(),
              );
            }
            return c;
          };
          c.limit = () => c;
          c.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
            Promise.resolve(result).then(res, rej);
          return c;
        },
      }),
      insert: (table: unknown) => ({
        values: (v: { identifier: string; token: string; expires: Date }) => {
          const name = getTableName(table as never);
          if (name === "verification_tokens") {
            state.tokens.push({ ...v });
            state.insertedTokens.push({ ...v });
          }
          return chain([]);
        },
      }),
      delete: (table: unknown) => ({
        where: (cond: unknown) => {
          const name = getTableName(table as never);
          const params = paramsOf(cond);
          if (name === "verification_tokens") {
            state.tokenDeletes.push(params);
            const [identifier, tokenHash] = params as [string, string | undefined];
            state.tokens = state.tokens.filter((t) =>
              tokenHash !== undefined
                ? !(t.identifier === identifier && t.token === tokenHash)
                : t.identifier !== identifier,
            );
          }
          return Promise.resolve([]);
        },
      }),
      update: (table: unknown) => ({
        set: (v: { passwordHash?: unknown }) => ({
          where: (cond: unknown) => ({
            returning: async () => {
              const name = getTableName(table as never);
              if (name === "users") {
                state.passwordUpdates.push({
                  passwordHash: v.passwordHash,
                  params: paramsOf(cond),
                });
                return state.updateReturnsRow ? [{ id: "u1" }] : [];
              }
              return [{ id: "u1" }];
            },
          }),
        }),
      }),
    },
  };
});

import {
  requestPasswordReset,
  consumePasswordReset,
} from "@/lib/auth/password-reset";
import { verifyPassword } from "@/lib/auth/password";

/** Pull the raw token out of the reset URL carried by the email mock. */
function rawTokenFromEmail(callIndex = 0): string {
  const arg = sendEmail.mock.calls[callIndex][0] as {
    data: { resetUrl: string };
  };
  return new URL(arg.data.resetUrl).searchParams.get("token")!;
}

const sha256 = (raw: string) => createHash("sha256").update(raw).digest("hex");

beforeEach(() => {
  vi.clearAllMocks();
  state.tokens = [];
  state.userExists = true;
  state.updateReturnsRow = true;
  state.insertedTokens = [];
  state.passwordUpdates = [];
  state.tokenDeletes = [];
  state.selectCount = 0;
  sendEmail.mockResolvedValue(true);
});

describe("requestPasswordReset — issuing a token", () => {
  it("issues a token and emails a reset link carrying the raw token", async () => {
    await requestPasswordReset(USER_EMAIL);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = sendEmail.mock.calls[0][0] as {
      to: string;
      template: string;
      data: { resetUrl: string; name?: string };
    };
    expect(arg.to).toBe(USER_EMAIL);
    expect(arg.template).toBe("password_reset");
    expect(arg.data.name).toBe("Test User");
    expect(arg.data.resetUrl).toContain("/reset-password?token=");
    expect(arg.data.resetUrl).toContain(`email=${encodeURIComponent(USER_EMAIL)}`);
    expect(rawTokenFromEmail()).toMatch(/^[0-9a-f]{64}$/); // 32 random bytes, hex
  });

  it("stores only the SHA-256 hash of the token, never the raw token", async () => {
    await requestPasswordReset(USER_EMAIL);
    const raw = rawTokenFromEmail();

    expect(state.insertedTokens).toHaveLength(1);
    const stored = state.insertedTokens[0];
    expect(stored.token).not.toBe(raw);
    expect(stored.token).toBe(sha256(raw));
    expect(stored.identifier).toBe(`password-reset:${USER_EMAIL}`);
  });

  it("sets an expiry about one hour in the future", async () => {
    const before = Date.now();
    await requestPasswordReset(USER_EMAIL);
    const after = Date.now();

    const ttl = state.insertedTokens[0].expires.getTime();
    expect(ttl).toBeGreaterThanOrEqual(before + 59 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(after + 61 * 60 * 1000);
  });

  it("normalizes case and surrounding whitespace in the email", async () => {
    await requestPasswordReset("  User@Example.COM ");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect((sendEmail.mock.calls[0][0] as { to: string }).to).toBe(USER_EMAIL);
    expect(state.insertedTokens[0].identifier).toBe(`password-reset:${USER_EMAIL}`);
  });

  it("resolves silently for an unknown account: no token, no email", async () => {
    state.userExists = false;
    await expect(requestPasswordReset("ghost@example.com")).resolves.toBeUndefined();
    expect(state.insertedTokens).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does nothing at all for an empty email", async () => {
    await expect(requestPasswordReset("   ")).resolves.toBeUndefined();
    expect(state.selectCount).toBe(0);
    expect(state.insertedTokens).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("replaces a previous token: the old raw token dies, the new one works", async () => {
    await requestPasswordReset(USER_EMAIL);
    const firstRaw = rawTokenFromEmail(0);
    await requestPasswordReset(USER_EMAIL);
    const secondRaw = rawTokenFromEmail(1);

    expect(secondRaw).not.toBe(firstRaw);
    // Delete-by-identifier ran before the second insert: one live row.
    expect(state.tokens).toHaveLength(1);
    expect(state.tokens[0].token).toBe(sha256(secondRaw));

    await expect(
      consumePasswordReset(USER_EMAIL, firstRaw, "new-password-1"),
    ).resolves.toBe(false);
    await expect(
      consumePasswordReset(USER_EMAIL, secondRaw, "new-password-1"),
    ).resolves.toBe(true);
  });
});

describe("consumePasswordReset — consuming a token", () => {
  it("succeeds with the correct token and stores a bcrypt hash of the new password", async () => {
    await requestPasswordReset(USER_EMAIL);
    const raw = rawTokenFromEmail();

    await expect(
      consumePasswordReset(USER_EMAIL, raw, "brand-new-password"),
    ).resolves.toBe(true);

    expect(state.passwordUpdates).toHaveLength(1);
    const update = state.passwordUpdates[0];
    // The password update is scoped to the account's own email row.
    expect(update.params).toContain(USER_EMAIL);
    const storedHash = update.passwordHash as string;
    expect(storedHash).not.toContain("brand-new-password");
    await expect(verifyPassword("brand-new-password", storedHash)).resolves.toBe(true);
    await expect(verifyPassword("not-the-password", storedHash)).resolves.toBe(false);
  });

  it("fails with a wrong token and leaves the real token usable", async () => {
    await requestPasswordReset(USER_EMAIL);
    const raw = rawTokenFromEmail();

    await expect(
      consumePasswordReset(USER_EMAIL, "0".repeat(64), "brand-new-password"),
    ).resolves.toBe(false);
    expect(state.passwordUpdates).toHaveLength(0);
    // A failed lookup returns before the burn step, so the row survives.
    expect(state.tokens).toHaveLength(1);

    await expect(
      consumePasswordReset(USER_EMAIL, raw, "brand-new-password"),
    ).resolves.toBe(true);
  });

  it("fails for a token issued to a different email account", async () => {
    await requestPasswordReset(USER_EMAIL);
    const raw = rawTokenFromEmail();

    await expect(
      consumePasswordReset("someone-else@example.com", raw, "brand-new-password"),
    ).resolves.toBe(false);
    expect(state.passwordUpdates).toHaveLength(0);
  });

  it("fails when the token has expired", async () => {
    await requestPasswordReset(USER_EMAIL);
    const raw = rawTokenFromEmail();
    // Age the stored row past its 1-hour TTL.
    state.tokens[0].expires = new Date(Date.now() - 60 * 1000);

    await expect(
      consumePasswordReset(USER_EMAIL, raw, "brand-new-password"),
    ).resolves.toBe(false);
    expect(state.passwordUpdates).toHaveLength(0);
  });

  it("is single-use: a consumed token cannot be reused", async () => {
    await requestPasswordReset(USER_EMAIL);
    const raw = rawTokenFromEmail();

    await expect(
      consumePasswordReset(USER_EMAIL, raw, "brand-new-password"),
    ).resolves.toBe(true);
    // The burn step removed the row before the password update ran.
    expect(state.tokens).toHaveLength(0);

    await expect(
      consumePasswordReset(USER_EMAIL, raw, "another-password"),
    ).resolves.toBe(false);
    expect(state.passwordUpdates).toHaveLength(1);
  });

  it("burns the token even when no user row ends up updated", async () => {
    await requestPasswordReset(USER_EMAIL);
    const raw = rawTokenFromEmail();
    state.updateReturnsRow = false; // users update matches no row

    await expect(
      consumePasswordReset(USER_EMAIL, raw, "brand-new-password"),
    ).resolves.toBe(false);
    // Burn-before-update: the token is gone despite the failed consume.
    expect(state.tokens).toHaveLength(0);
  });

  it("rejects a new password shorter than 6 characters without touching the token", async () => {
    await requestPasswordReset(USER_EMAIL);
    const raw = rawTokenFromEmail();
    const selectsBefore = state.selectCount;

    await expect(consumePasswordReset(USER_EMAIL, raw, "12345")).resolves.toBe(false);
    expect(state.selectCount).toBe(selectsBefore); // rejected up front
    expect(state.passwordUpdates).toHaveLength(0);
    expect(state.tokens).toHaveLength(1); // not burned by the rejection
  });

  it("rejects empty email / empty token inputs", async () => {
    await expect(consumePasswordReset("", "sometoken", "long-enough")).resolves.toBe(false);
    await expect(consumePasswordReset(USER_EMAIL, "", "long-enough")).resolves.toBe(false);
    expect(state.passwordUpdates).toHaveLength(0);
  });
});
