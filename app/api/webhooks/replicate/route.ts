import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { hasActiveConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import { familyVoices } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { verifyReplicateWebhook } from "@/lib/webhook-signature";

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

    if (body.status === "succeeded" && body.version) {
      const modelVersion = body.version;

      // We temporarily stored the training id in rvc_model_id when we started the job
      const voices = await db
        .select({ id: familyVoices.id, userId: familyVoices.userId })
        .from(familyVoices)
        .where(eq(familyVoices.rvcModelId, trainingId));

      if (voices.length > 0) {
        const voiceId = voices[0].id;

        // Never mark a singing model ready for a user who revoked consent.
        if (!(await hasActiveConsent(voices[0].userId))) {
          await db
            .update(familyVoices)
            .set({ rvcTrainingStatus: "failed", rvcModelId: null })
            .where(eq(familyVoices.id, voiceId));
          logger.warn("replicate_webhook_ignored_no_consent", { voiceId });
          return NextResponse.json({ success: true });
        }

        await db
          .update(familyVoices)
          .set({
            rvcTrainingStatus: "ready",
            rvcModelId: modelVersion,
          })
          .where(eq(familyVoices.id, voiceId));
      }
    } else if (body.status === "failed" || body.status === "canceled") {
      await db
        .update(familyVoices)
        .set({
          rvcTrainingStatus: body.status === "canceled" ? "cancelled" : "failed",
        })
        .where(eq(familyVoices.rvcModelId, trainingId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("replicate_webhook_failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
