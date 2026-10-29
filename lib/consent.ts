import { and, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { consentOwnedBy, selfUser } from "./authz";
import { db } from "./db";
import { consentRecords, users } from "./db/schema";
import { isProduction } from "./env";

/**
 * Salt for the consent audit digests (signature / IP hashes).
 *
 * Source order: CONSENT_HASH_SALT, then AUTH_SECRET. The historical
 * last-resort fallback was the public constant "development-only" —
 * if a production deploy ever ran with neither var set, every digest
 * would be keyed by a value anyone can read in the source. That is
 * now fail-closed: in production this throws (and AUTH_SECRET is a
 * required, >=32-char var in lib/env.ts, so a validated boot cannot
 * reach the throw). The public fallback remains only in dev/test,
 * where digests are throwaway fixture data.
 */
export function getConsentHashSalt(): string {
  const salt = process.env.CONSENT_HASH_SALT ?? process.env.AUTH_SECRET;
  if (salt) return salt;
  if (isProduction()) {
    throw new Error(
      "CONSENT_HASH_SALT / AUTH_SECRET is not set; refusing to key consent audit digests with a public fallback in production"
    );
  }
  return "development-only";
}

export async function hasActiveConsent(userId: string): Promise<boolean> {
  try {
    const [user] = await db
      .select({ consentVerified: users.consentVerified })
      .from(users)
      .where(selfUser(userId))
      .limit(1);
    if (!user || user.consentVerified !== true) return false;

    // Accounts that consented before the 18+ attestation existed must re-consent:
    // require an unrevoked record that carries the attestation.
    const [record] = await db
      .select({ id: consentRecords.id })
      .from(consentRecords)
      .where(
        and(
          consentOwnedBy(userId),
          isNull(consentRecords.revokedAt),
          isNotNull(consentRecords.adultConfirmedAt)
        )
      )
      .limit(1);
    return !!record;
  } catch {
    // Fail closed, exactly as the PostgREST version did on query errors.
    return false;
  }
}

/**
 * Shared guard for every route or webhook that processes a person's voice,
 * face, or body. Returns a 403 response when consent is missing or revoked,
 * or `null` when the caller may proceed.
 */
export async function requireActiveConsent(userId: string): Promise<NextResponse | null> {
  if (await hasActiveConsent(userId)) return null;
  return NextResponse.json(
    { error: "Active consent is required before biometric processing.", consentRequired: true },
    { status: 403 }
  );
}
