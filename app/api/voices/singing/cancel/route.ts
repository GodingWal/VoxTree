import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { safeJson } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { familyVoices } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { cancelTraining } from "@/lib/replicate";

const cancelSchema = z.object({
  voiceId: z.string().uuid(),
});

/**
 * Cancel an in-flight RVC training job. Idempotent — returns 200 even if
 * the training already finished or was already cancelled.
 */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = { id: userId };

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

  const [voice] = await db
    .select({
      id: familyVoices.id,
      userId: familyVoices.userId,
      rvcTrainingStatus: familyVoices.rvcTrainingStatus,
      rvcModelId: familyVoices.rvcModelId,
    })
    .from(familyVoices)
    .where(eq(familyVoices.id, voiceId))
    .limit(1);

  if (!voice || voice.userId !== user.id) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  if (voice.rvcTrainingStatus !== "processing" || !voice.rvcModelId) {
    return NextResponse.json({ status: voice.rvcTrainingStatus ?? "idle" });
  }

  // rvc_model_id currently holds the Replicate training id during processing.
  const cancelled = await cancelTraining(voice.rvcModelId);
  if (!cancelled) {
    logger.warn("rvc_cancel_replicate_failed", {
      voiceId,
      userId: user.id,
      trainingId: voice.rvcModelId,
    });
  }

  await db
    .update(familyVoices)
    .set({ rvcTrainingStatus: "cancelled" })
    .where(eq(familyVoices.id, voiceId));

  return NextResponse.json({ status: "cancelled" });
}
