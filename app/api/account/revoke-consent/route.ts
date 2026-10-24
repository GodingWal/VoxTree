import { NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteVoice } from "@/lib/elevenlabs";
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
  // Best-effort: each step runs independently so one failure (e.g. a provider outage)
  // cannot skip the rest; failures are logged but do not fail the revocation itself,
  // since the auditable revoked_at is the source of truth.
  const failures: string[] = [];
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  let voiceRows: { id: string; elevenlabs_voice_id: string | null }[] = [];
  await step("list_voices", async () => {
    const { data, error: listError } = await admin
      .from("family_voices")
      .select("id, elevenlabs_voice_id")
      .eq("user_id", user.id);
    if (listError) throw listError;
    voiceRows = data ?? [];
  });

  // Delete the provider-side biometric voice clones. Rows whose clone was deleted lose
  // the provider id; every row is marked failed so a later re-consent cannot resurrect
  // a revoked clone (a row whose deletion failed keeps its id for retry).
  const deletedIds: string[] = [];
  await Promise.all(
    voiceRows
      .filter((v) => v.elevenlabs_voice_id)
      .map((v) =>
        step(`delete_voice:${v.id}`, async () => {
          await deleteVoice(v.elevenlabs_voice_id!);
          deletedIds.push(v.id);
        })
      )
  );
  if (voiceRows.length > 0) {
    await step("neutralise_voices", async () => {
      const { error: updError } = await admin
        .from("family_voices")
        .update({ status: "failed" })
        .eq("user_id", user.id);
      if (updError) throw updError;
      if (deletedIds.length > 0) {
        const { error: clearError } = await admin
          .from("family_voices")
          .update({ elevenlabs_voice_id: null })
          .in("id", deletedIds);
        if (clearError) throw clearError;
      }
    });
  }

  // Delete each voice's sampled media and any clips that reference it
  await Promise.all(voiceRows.map((v) => step(`delete_media:${v.id}`, () => deleteVoiceMedia(user.id, v.id))));

  // Catch any stray voice-samples/clips not tied to a known voice row
  await step("purge_voice_samples", () => deleteObjectPrefix(`voice-samples/${user.id}/`));
  await step("purge_clips", () => deleteObjectPrefix(`clips/${user.id}/`));

  // Purge consent video selfie proofs
  await step("purge_consent_video", () => deleteObjectPrefix(GCP_PATHS.consentVideoPrefix(user.id)));

  if (failures.length > 0) {
    logger.error("revoke_consent_purge_failed", { userId: user.id, failures });
  }

  logger.warn("account_consent_revoked", { userId: user.id });
  return NextResponse.json({ success: true });
}
