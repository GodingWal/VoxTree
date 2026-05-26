import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeJson } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const body = parsedJson.body as {
    id?: string;
    status?: string;
    version?: string;
  };

  try {

    // Replicate sends the completed training payload.
    // In production, we should verify the `webhook-signature` header using the REPLICATE_WEBHOOK_SECRET.
    
    const trainingId = body.id;

    if (!trainingId) {
      return NextResponse.json({ error: "Missing training id" }, { status: 400 });
    }

    const admin = createAdminClient();

    if (body.status === "succeeded" && body.version) {
      const modelVersion = body.version;

      // We temporarily stored the training id in rvc_model_id when we started the job
      const { data: voices } = await admin
        .from("family_voices")
        .select("id")
        .eq("rvc_model_id", trainingId);

      if (voices && voices.length > 0) {
        const voiceId = voices[0].id;
        
        // Update to the finalized model version id and mark as ready
        await admin
          .from("family_voices")
          .update({
            rvc_training_status: "ready",
            rvc_model_id: modelVersion,
          })
          .eq("id", voiceId);
      }
    } else if (body.status === "failed" || body.status === "canceled") {
      // Revert the status to failed so the user can try again
      await admin
        .from("family_voices")
        .update({
          rvc_training_status: "failed",
        })
        .eq("rvc_model_id", trainingId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("replicate_webhook_failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
