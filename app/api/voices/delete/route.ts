import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { safeJson } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { familyVoices, generatedClips } from "@/lib/db/schema";
import { deleteVoiceMedia } from "@/lib/gcp";
import { logger } from "@/lib/logger";
import { deleteVoice } from "@/lib/voice-provider";

const deleteSchema = z.object({
  voiceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };

  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const parsed = deleteSchema.safeParse(parsedJson.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { voiceId } = parsed.data;

  // Verify ownership
  const [voice] = await db
    .select({
      id: familyVoices.id,
      userId: familyVoices.userId,
      providerVoiceId: familyVoices.providerVoiceId,
    })
    .from(familyVoices)
    .where(eq(familyVoices.id, voiceId))
    .limit(1);

  if (!voice || voice.userId !== user.id) {
    return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  }

  try {
    // Delete from the voice provider if it exists
    if (voice.providerVoiceId) {
      try {
        await deleteVoice(voice.providerVoiceId);
      } catch (elError) {
        logger.warn("provider_voice_delete_failed", {
          providerVoiceId: voice.providerVoiceId,
          voiceId,
          message: elError instanceof Error ? elError.message : "Unknown error",
        });
      }
    }

    // Delete related clips to prevent orphaned data
    await db.delete(generatedClips).where(eq(generatedClips.voiceId, voiceId));

    // Delete the original sample, normalized sample, and every generated clip for this voice.
    await deleteVoiceMedia(user.id, voiceId);

    // Delete the voice record
    await db.delete(familyVoices).where(eq(familyVoices.id, voiceId));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("voice_delete_failed", {
      voiceId,
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Failed to delete voice" }, { status: 500 });
  }
}
