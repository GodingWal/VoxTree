"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";

const CONSENT_NOTICE_VERSION = "2026-08-29";

const consentSchema = z.object({
  parentName: z.string().trim().min(2).max(120),
  parentRelationship: z.string().trim().min(2).max(80),
  signature: z.string().trim().min(2).max(120),
  agreementAccepted: z.literal(true),
  voiceOwnerAuthorizationConfirmed: z.literal(true),
  /** When video selfie was verified first, this id links the two records. */
  consentId: z.string().uuid().optional(),
});

export async function verifyParentalConsent(input: unknown) {
  const parsed = consentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Complete every consent field." };
  if (parsed.data.signature.toLocaleLowerCase() !== parsed.data.parentName.toLocaleLowerCase()) {
    return { success: false, error: "Digital signature must match the parent or guardian name." };
  }
  const supabase = await createClient();

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be logged in to verify consent." };
  }

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "development-only";
  const digest = (value: string) => createHash("sha256").update(`${salt}:${value}`).digest("hex");

  // If consentId links to a video-verified placeholder created by /api/consent/video,
  // update that row instead of inserting a duplicate so video_gcs_key is retained.
  if (parsed.data.consentId) {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("consent_records")
      .select("id, video_gcs_key, verified_at")
      .eq("id", parsed.data.consentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const now = existing.verified_at ?? new Date().toISOString();
      const { error: updErr } = await admin
        .from("consent_records")
        .update({
          notice_version: CONSENT_NOTICE_VERSION,
          parent_name: parsed.data.parentName,
          parent_relationship: parsed.data.parentRelationship,
          signature_sha256: digest(parsed.data.signature),
          voice_owner_authorization_confirmed: parsed.data.voiceOwnerAuthorizationConfirmed,
          ip_sha256: digest(ip),
          user_agent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
          verified_at: now,
          // keep video_gcs_key if already set
        })
        .eq("id", existing.id);

      if (updErr) {
        console.error("Failed to update consent record with video linkage:", updErr);
        return { success: false, error: "Consent could not be recorded. No authorization was granted." };
      }

      const { error } = await supabase
        .from("users")
        .update({
          consent_verified: true,
          consent_verified_at: now,
          consent_notice_version: CONSENT_NOTICE_VERSION,
        })
        .eq("id", user.id);

      if (error) {
        console.error("Failed to verify parental consent:", error);
        return { success: false, error: error.message };
      }
      revalidatePath("/consent");
      revalidatePath("/dashboard", "layout");
      return { success: true, consentId: existing.id };
    }
    // fallback to insert if id not found
  }

  const { error: auditError } = await supabase.from("consent_records").insert({
    user_id: user.id,
    notice_version: CONSENT_NOTICE_VERSION,
    parent_name: parsed.data.parentName,
    parent_relationship: parsed.data.parentRelationship,
    signature_sha256: digest(parsed.data.signature),
    voice_owner_authorization_confirmed: parsed.data.voiceOwnerAuthorizationConfirmed,
    ip_sha256: digest(ip),
    user_agent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
    // video_gcs_key / verified_at may be populated later by /api/consent/video verify
    // if video was verified before consent insert, that row is the one above; otherwise
    // the video verify call after this insert will update this row.
  });

  if (auditError) {
    console.error("Failed to create consent audit record:", auditError);
    return { success: false, error: "Consent could not be recorded. No authorization was granted." };
  }

  const { error } = await supabase
    .from("users")
    .update({
      consent_verified: true,
      consent_verified_at: new Date().toISOString(),
      consent_notice_version: CONSENT_NOTICE_VERSION,
    })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to verify parental consent:", error);
    return { success: false, error: error.message };
  }

  // 3. Clear cache
  revalidatePath("/consent");
  revalidatePath("/dashboard", "layout");

  return { success: true };
}
