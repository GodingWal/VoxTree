import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

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

  let payload: any;
  try {
    payload = await request.json();
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
