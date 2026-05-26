import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforcePaidRateLimit, safeJson } from "@/lib/api-helpers";
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

  // 1. Verify ownership
  const { data: voice } = await supabase
    .from("family_voices")
    .select("id, user_id, sample_audio_url")
    .eq("id", voiceId)
    .single();

  if (!voice || voice.user_id !== user.id) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
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
