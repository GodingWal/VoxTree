import { NextResponse } from "next/server";
import { createAdminClient } from "./supabase/admin";

export async function hasActiveConsent(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("consent_verified")
    .eq("id", userId)
    .single();
  if (error || data?.consent_verified !== true) return false;

  // Accounts that consented before the 18+ attestation existed must re-consent:
  // require an unrevoked record that carries the attestation.
  const { data: record } = await admin
    .from("consent_records")
    .select("id")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .not("adult_confirmed_at", "is", null)
    .limit(1)
    .maybeSingle();
  return !!record;
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
