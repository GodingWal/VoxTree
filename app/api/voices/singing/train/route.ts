import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  enforcePaidRateLimit,
  enforceUserRateLimit,
  safeJson,
} from "@/lib/api-helpers";
import { checkCostCap, recordUsage } from "@/lib/cost-tracking";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { trainSingingModel } from "@/lib/replicate";
import { getPresignedDownloadUrl } from "@/lib/gcp";

const trainSchema = z.object({
  voiceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const rateLimited = enforcePaidRateLimit(request);
  if (rateLimited) return rateLimited;

  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const parsed = trainSchema.safeParse(parsedJson.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.format() }, { status: 400 });
  }

  const { voiceId } = parsed.data;

  // Per-user durable cap: max 2 RVC trainings per day. Training is expensive.
  const userLimited = await enforceUserRateLimit({
    userId: user.id,
    bucket: "singing_train",
    limit: 2,
    windowSeconds: 24 * 60 * 60,
  });
  if (userLimited) return userLimited;

  // Cost cap per plan.
  const costCheck = await checkCostCap(user.id, { kind: "replicate_training" });
  if (!costCheck.allowed) {
    return NextResponse.json(
      { error: costCheck.reason, code: "cost_cap_reached" },
      { status: 429 }
    );
  }

  // 1. Verify ownership
  const { data: voice } = await supabase
    .from("family_voices")
    .select("id, user_id, sample_audio_url, rvc_training_status, rvc_model_id")
    .eq("id", voiceId)
    .single();

  if (!voice || voice.user_id !== user.id) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  // Idempotency: don't kick off a second training when one is in flight
  // or already finished successfully.
  if (voice.rvc_training_status === "processing" && voice.rvc_model_id) {
    return NextResponse.json({
      status: "processing",
      trainingId: voice.rvc_model_id,
      idempotent: true,
    });
  }
  if (voice.rvc_training_status === "ready") {
    return NextResponse.json({
      status: "ready",
      rvcModelId: voice.rvc_model_id,
      idempotent: true,
    });
  }

  if (!voice.sample_audio_url) {
    return NextResponse.json({ error: "No audio sample available to train on" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    // 2. Generate a public URL for Replicate to download the audio from GCP
    const audioUrl = await getPresignedDownloadUrl(voice.sample_audio_url);

    // 3. Setup the Webhook URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const webhookUrl = `${appUrl}/api/webhooks/replicate`;

    // 4. Trigger Replicate Training
    const training = await trainSingingModel(audioUrl, webhookUrl);

    // 5. Update Database to processing status and store the training ID
    await admin
      .from("family_voices")
      .update({
        rvc_training_status: "processing",
        rvc_model_id: training.id, // Temporarily store training ID here so we can poll status if needed
      })
      .eq("id", voiceId);

    await recordUsage(user.id, { kind: "replicate_training" });

    return NextResponse.json({ status: "processing", trainingId: training.id });
  } catch (error) {
    logger.error("rvc_training_init_failed", {
      voiceId,
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    await admin.from("family_voices").update({ rvc_training_status: "failed" }).eq("id", voiceId);
    return NextResponse.json({ error: "Failed to initiate training" }, { status: 500 });
  }
}
