import { and, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { consentOwnedBy, selfUser } from "./authz";
import { db } from "./db";
import { consentRecords, users } from "./db/schema";

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
