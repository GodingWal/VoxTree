import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import { sendTransactionalEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

import { hashPassword } from "./password";

/**
 * Password reset (Phase 3, replaces the hosted `resetPasswordForEmail`).
 *
 * Tokens are single-use, 1-hour, stored SHA-256-hashed in
 * `verification_tokens` under identifier `password-reset:<email>`.
 * Delivery goes through the transactional-email webhook when configured
 * (template `password_reset`); otherwise, in non-production, the link is
 * written to the server log so the local flow works end-to-end.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000;

function identifierFor(email: string) {
  return `password-reset:${email}`;
}

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Starts a reset for `email`. Always resolves — callers must return the
 * same generic response whether or not the account exists (no account
 * enumeration).
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.toLowerCase().trim();
  if (!email) return;

  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) return;

  const identifier = identifierFor(email);
  const rawToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, identifier));
  await db.insert(verificationTokens).values({
    identifier,
    token: hashToken(rawToken),
    expires,
  });

  const resetUrl =
    `${appUrl()}/reset-password?token=${rawToken}` +
    `&email=${encodeURIComponent(email)}`;

  const sent = await sendTransactionalEmail({
    to: email,
    template: "password_reset",
    data: { resetUrl, name: user.name ?? undefined },
  });
  if (!sent && process.env.NODE_ENV !== "production") {
    logger.info("password_reset_link_dev", { email, resetUrl });
  }
}

/**
 * Consumes a reset token and sets a new password. Returns false for any
 * invalid/expired/used token or unknown account.
 */
export async function consumePasswordReset(
  rawEmail: string,
  rawToken: string,
  newPassword: string,
): Promise<boolean> {
  const email = rawEmail.toLowerCase().trim();
  if (!email || !rawToken || newPassword.length < 6) return false;

  const identifier = identifierFor(email);
  const tokenHash = hashToken(rawToken);

  const [row] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.token, tokenHash),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .limit(1);
  if (!row) return false;

  // Single-use: burn the token before updating so a failure mid-way
  // can't leave a reusable token behind.
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.token, tokenHash),
      ),
    );

  const passwordHash = await hashPassword(newPassword);
  const updated = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.email, email))
    .returning({ id: users.id });
  return updated.length > 0;
}
