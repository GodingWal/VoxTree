import { NextResponse } from "next/server";
import { createAdminClient } from "./supabase/admin";

export async function hasActiveConsent(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("consent_verified")
    .eq("id", userId)
    .single();
  return !error && data?.consent_verified === true;
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
