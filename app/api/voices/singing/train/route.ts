import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  enforcePaidRateLimit,
  enforceUserRateLimit,
  safeJson,
} from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth/session";
import { requireActiveConsent } from "@/lib/consent";
import { checkCostCap, recordUsage } from "@/lib/cost-tracking";
import { db } from "@/lib/db";
import { familyVoices } from "@/lib/db/schema";
import { getPresignedDownloadUrl } from "@/lib/gcp";
import { logger } from "@/lib/logger";
import { trainSingingModel } from "@/lib/replicate";

const trainSchema = z.object({
  voiceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const rateLimited = await enforcePaidRateLimit(request);
  if (rateLimited) return rateLimited;

  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = { id: userId };

  const consentBlocked = await requireActiveConsent(user.id);
  if (consentBlocked) return consentBlocked;

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
  const [voice] = await db
    .select({
      id: familyVoices.id,
      userId: familyVoices.userId,
      sampleAudioKey: familyVoices.sampleAudioKey,
      rvcTrainingStatus: familyVoices.rvcTrainingStatus,
      rvcModelId: familyVoices.rvcModelId,
    })
    .from(familyVoices)
    .where(eq(familyVoices.id, voiceId))
    .limit(1);

  if (!voice || voice.userId !== user.id) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  // Idempotency: don't kick off a second training when one is in flight
  // or already finished successfully.
  if (voice.rvcTrainingStatus === "processing" && voice.rvcModelId) {
    return NextResponse.json({
      status: "processing",
      trainingId: voice.rvcModelId,
      idempotent: true,
    });
  }
  if (voice.rvcTrainingStatus === "ready") {
    return NextResponse.json({
      status: "ready",
      rvcModelId: voice.rvcModelId,
      idempotent: true,
    });
  }

  if (!voice.sampleAudioKey) {
    return NextResponse.json({ error: "No audio sample available to train on" }, { status: 400 });
  }

  try {
    // 2. Generate a public URL for Replicate to download the audio from GCP
    const audioUrl = await getPresignedDownloadUrl(voice.sampleAudioKey);

    // 3. Setup the Webhook URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const webhookUrl = `${appUrl}/api/webhooks/replicate`;

    // 4. Trigger Replicate Training
    const training = await trainSingingModel(audioUrl, webhookUrl);

    // 5. Update Database to processing status and store the training ID
    await db
      .update(familyVoices)
      .set({
        rvcTrainingStatus: "processing",
        rvcModelId: training.id, // Temporarily store training ID here so we can poll status if needed
      })
      .where(eq(familyVoices.id, voiceId));

    await recordUsage(user.id, { kind: "replicate_training" });

    return NextResponse.json({ status: "processing", trainingId: training.id });
  } catch (error) {
    logger.error("rvc_training_init_failed", {
      voiceId,
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    await db.update(familyVoices).set({ rvcTrainingStatus: "failed" }).where(eq(familyVoices.id, voiceId));
    return NextResponse.json({ error: "Failed to initiate training" }, { status: 500 });
  }
}
