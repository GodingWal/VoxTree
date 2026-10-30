"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";

import { consentOwnedBy, selfUser } from "@/lib/authz";
import { getCurrentUserId } from "@/lib/auth/session";
import { getConsentHashSalt } from "@/lib/consent";
import { db } from "@/lib/db";
import { consentRecords, users } from "@/lib/db/schema";

const CONSENT_NOTICE_VERSION = "2026-10-15";

const consentSchema = z.object({
  parentName: z.string().trim().min(2).max(120),
  parentRelationship: z.string().trim().min(2).max(80),
  signature: z.string().trim().min(2).max(120),
  agreementAccepted: z.literal(true),
  /** Attestation that the person whose voice/face is captured is 18 or older. */
  adultConfirmed: z.literal(true),
  voiceOwnerAuthorizationConfirmed: z.literal(true),
  /** When video selfie was verified first, this id links the two records. */
  consentId: z.string().uuid().optional(),
});

export async function verifyParentalConsent(input: unknown) {
  const parsed = consentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Complete every consent field, including the 18+ confirmation." };
  }
  if (parsed.data.signature.toLocaleLowerCase() !== parsed.data.parentName.toLocaleLowerCase()) {
    return { success: false, error: "Digital signature must match the parent or guardian name." };
  }

  // 1. Get authenticated user
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "You must be logged in to verify consent." };
  }

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // Hash salt for the audit digests. These digests are write-only audit
  // data (nothing re-derives them for comparison), so the salt source
  // moved off the retired hosted service-role key in Phase 4. Resolved
  // via lib/consent: CONSENT_HASH_SALT ?? AUTH_SECRET, fail-closed in
  // production instead of the old public "development-only" fallback.
  const salt = getConsentHashSalt();
  const digest = (value: string) => createHash("sha256").update(`${salt}:${value}`).digest("hex");

  // If consentId links to a video-verified placeholder created by /api/consent/video,
  // update that row instead of inserting a duplicate so video_gcs_key is retained.
  if (parsed.data.consentId) {
    const [existing] = await db
      .select({
        id: consentRecords.id,
        videoGcsKey: consentRecords.videoGcsKey,
        verifiedAt: consentRecords.verifiedAt,
      })
      .from(consentRecords)
      .where(and(eq(consentRecords.id, parsed.data.consentId), consentOwnedBy(userId)))
      .limit(1);

    if (existing) {
      const now = existing.verifiedAt ?? new Date();
      try {
        await db
          .update(consentRecords)
          .set({
            noticeVersion: CONSENT_NOTICE_VERSION,
            parentName: parsed.data.parentName,
            parentRelationship: parsed.data.parentRelationship,
            signatureSha256: digest(parsed.data.signature),
            voiceOwnerAuthorizationConfirmed: parsed.data.voiceOwnerAuthorizationConfirmed,
            adultConfirmedAt: new Date(),
            ipSha256: digest(ip),
            userAgent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
            verifiedAt: now,
            // keep video_gcs_key if already set
          })
          .where(eq(consentRecords.id, existing.id));
      } catch (updErr) {
        console.error("Failed to update consent record with video linkage:", updErr);
        return { success: false, error: "Consent could not be recorded. No authorization was granted." };
      }

      try {
        await db
          .update(users)
          .set({
            consentVerified: true,
            consentVerifiedAt: now,
            consentNoticeVersion: CONSENT_NOTICE_VERSION,
          })
          .where(selfUser(userId));
      } catch (error) {
        console.error("Failed to verify parental consent:", error);
        return { success: false, error: error instanceof Error ? error.message : "Consent could not be recorded." };
      }
      revalidatePath("/consent");
      revalidatePath("/dashboard", "layout");
      return { success: true, consentId: existing.id };
    }
    // fallback to insert if id not found
  }

  try {
    await db.insert(consentRecords).values({
      userId,
      noticeVersion: CONSENT_NOTICE_VERSION,
      parentName: parsed.data.parentName,
      parentRelationship: parsed.data.parentRelationship,
      signatureSha256: digest(parsed.data.signature),
      voiceOwnerAuthorizationConfirmed: parsed.data.voiceOwnerAuthorizationConfirmed,
      adultConfirmedAt: new Date(),
      ipSha256: digest(ip),
      userAgent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
      // video_gcs_key / verified_at may be populated later by /api/consent/video verify
      // if video was verified before consent insert, that row is the one above; otherwise
      // the video verify call after this insert will update this row.
    });
  } catch (auditError) {
    console.error("Failed to create consent audit record:", auditError);
    return { success: false, error: "Consent could not be recorded. No authorization was granted." };
  }

  try {
    await db
      .update(users)
      .set({
        consentVerified: true,
        consentVerifiedAt: new Date(),
        consentNoticeVersion: CONSENT_NOTICE_VERSION,
      })
      .where(selfUser(userId));
  } catch (error) {
    console.error("Failed to verify parental consent:", error);
    return { success: false, error: error instanceof Error ? error.message : "Consent could not be recorded." };
  }

  // 3. Clear cache
  revalidatePath("/consent");
  revalidatePath("/dashboard", "layout");

  return { success: true };
}
