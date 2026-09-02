import { NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteVoiceMedia, deleteObjectPrefix, GCP_PATHS } from "@/lib/gcp";
import { logger } from "@/lib/logger";

export async function POST() {
  const supabase = await getRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin.from("users").update({ consent_verified: false }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Consent could not be revoked" }, { status: 500 });

  await admin.from("consent_records").update({ revoked_at: now }).eq("user_id", user.id).is("revoked_at", null);
  await admin.from("data_lifecycle_requests").insert({ user_id: user.id, request_type: "revoke_consent", status: "completed", completed_at: now });

  // Auto-purge: delete all private voice media and consent video proof for this user.
  // Best-effort: purge failures are logged but do not fail the revocation itself,
  // since the auditable revoked_at is the source of truth.
  try {
    const { data: voices } = await admin.from("family_voices").select("id").eq("user_id", user.id);
    const voiceIds: string[] = (voices ?? []).map((v: { id: string }) => v.id);

    // Delete each voice's sampled media and any clips that reference it
    await Promise.all(voiceIds.map((voiceId) => deleteVoiceMedia(user.id, voiceId).catch(() => 0)));

    // Catch any stray voice-samples/clips not tied to a known voice row
    await deleteObjectPrefix(`voice-samples/${user.id}/`).catch(() => 0);
    await deleteObjectPrefix(`clips/${user.id}/`).catch(() => 0);

    // Purge consent video selfie proofs
    await deleteObjectPrefix(GCP_PATHS.consentVideoPrefix(user.id)).catch(() => 0);
  } catch (e) {
    logger.error("revoke_consent_purge_failed", {
      userId: user.id,
      message: e instanceof Error ? e.message : String(e),
    });
  }

  logger.warn("account_consent_revoked", { userId: user.id });
  return NextResponse.json({ success: true });
}
