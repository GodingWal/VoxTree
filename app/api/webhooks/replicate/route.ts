import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyReplicateWebhook } from "@/lib/webhook-signature";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  // Read the raw body once for signature verification — JSON.parse would
  // re-serialize and break the HMAC.
  const rawBody = await request.text();

  const verification = verifyReplicateWebhook({
    rawBody,
    headers: request.headers,
  });

  if (!verification.ok) {
    logger.warn("replicate_webhook_rejected", { reason: verification.reason });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  if (verification.simulated) {
    logger.info("replicate_webhook_unsigned", {
      note: "REPLICATE_WEBHOOK_SECRET not configured; accepted without verification",
    });
  }

  let body: { id?: string; status?: string; version?: string };
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
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

        await admin
          .from("family_voices")
          .update({
            rvc_training_status: "ready",
            rvc_model_id: modelVersion,
          })
          .eq("id", voiceId);
      }
    } else if (body.status === "failed" || body.status === "canceled") {
      await admin
        .from("family_voices")
        .update({
          rvc_training_status: body.status === "canceled" ? "cancelled" : "failed",
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
