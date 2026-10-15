import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { verifyReplicateWebhook } from "@/lib/webhook-signature";
import { hasActiveConsent } from "@/lib/consent";

/**
 * Replicate webhook for Flux LoRA training completion. Stores the trained
 * model version so subsequent Pixar inference calls can target it.
 *
 * Replicate posts a `prediction`-like payload with `id`, `status`, `output`,
 * `version`, and `error`. On success we record the version + weights URL so
 * the family member's clone is ready for use.
 */
export async function POST(request: NextRequest) {
  const voiceId = request.nextUrl.searchParams.get("voiceId");
  if (!voiceId) {
    return NextResponse.json({ error: "voiceId required" }, { status: 400 });
  }

  // Read the raw body once: the HMAC is computed over the exact bytes.
  const rawBody = await request.text();
  const verification = verifyReplicateWebhook({ rawBody, headers: request.headers });
  if (!verification.ok) {
    logger.warn("lora_webhook_rejected", { reason: verification.reason });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status: string | undefined = payload?.status;
  const trainingId: string | undefined = payload?.id;
  const trainedVersion: string | undefined =
    payload?.output?.version ||
    payload?.version ||
    payload?.output?.weights_version;
  const weightsUrl: string | undefined =
    payload?.output?.weights ||
    (typeof payload?.output === "string" ? payload.output : undefined);

  const admin = createAdminClient();

  // Do not mark a clone ready for a user who has revoked consent.
  const { data: owner } = await admin.from("family_voices").select("user_id").eq("id", voiceId).single();
  if (owner?.user_id && !(await hasActiveConsent(owner.user_id))) {
    await admin.from("family_voices").update({ lora_status: "failed", lora_version: null, lora_weights_url: null }).eq("id", voiceId);
    logger.warn("lora_webhook_ignored_no_consent", { voiceId });
    return NextResponse.json({ ok: true });
  }

  if (status === "succeeded" && trainedVersion) {
    await admin
      .from("family_voices")
      .update({
        lora_status: "ready",
        lora_version: trainedVersion,
        lora_weights_url: weightsUrl ?? null,
      })
      .eq("id", voiceId);

    logger.info("lora_training_succeeded", { voiceId, trainingId, trainedVersion });
    return NextResponse.json({ ok: true });
  }

  if (status === "failed" || status === "canceled") {
    await admin
      .from("family_voices")
      .update({ lora_status: "failed" })
      .eq("id", voiceId);

    logger.warn("lora_training_failed", {
      voiceId,
      trainingId,
      error: payload?.error ?? null,
    });
    return NextResponse.json({ ok: true });
  }

  // Intermediate states ("starting", "processing") — ignore.
  return NextResponse.json({ ok: true });
}
