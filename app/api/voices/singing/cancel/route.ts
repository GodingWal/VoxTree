import { NextResponse } from "next/server";
import { z } from "zod";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelTraining } from "@/lib/replicate";
import { safeJson } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

const cancelSchema = z.object({
  voiceId: z.string().uuid(),
});

/**
 * Cancel an in-flight RVC training job. Idempotent — returns 200 even if
 * the training already finished or was already cancelled.
 */
export async function POST(request: Request) {
  const supabase = getRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const parsed = cancelSchema.safeParse(parsedJson.body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { voiceId } = parsed.data;

  const { data: voice } = await supabase
    .from("family_voices")
    .select("id, user_id, rvc_training_status, rvc_model_id")
    .eq("id", voiceId)
    .single();

  if (!voice || voice.user_id !== user.id) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  if (voice.rvc_training_status !== "processing" || !voice.rvc_model_id) {
    return NextResponse.json({ status: voice.rvc_training_status ?? "idle" });
  }

  // rvc_model_id currently holds the Replicate training id during processing.
  const cancelled = await cancelTraining(voice.rvc_model_id);
  if (!cancelled) {
    logger.warn("rvc_cancel_replicate_failed", {
      voiceId,
      userId: user.id,
      trainingId: voice.rvc_model_id,
    });
  }

  const admin = createAdminClient();
  await admin
    .from("family_voices")
    .update({ rvc_training_status: "cancelled" })
    .eq("id", voiceId);

  return NextResponse.json({ status: "cancelled" });
}
