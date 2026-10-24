import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { enforcePaidRateLimit, safeJson } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth/session";
import { selfUser, voiceOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import { familyVoices, users } from "@/lib/db/schema";
import { requireActiveConsent } from "@/lib/consent";
import { logger } from "@/lib/logger";
import { runPixarLoraInference } from "@/lib/replicate";
import { UPLOADS_DIR } from "@/lib/uploads";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

const schema = z.object({
  voiceId: z.string().uuid(),
  prompt: z.string().max(500).optional(),
  aspectRatio: z.enum(["1:1", "3:4", "4:3", "16:9", "9:16"]).optional(),
});

/**
 * Generate a Pixar-style portrait of a family member using their trained
 * personal Flux LoRA stacked with a Pixar style LoRA. Identity preservation
 * is far stronger than the single-shot face-to-many path.
 *
 * Requires that POST /api/avatar/train has been run for this voiceId and
 * the training completed (lora_status = 'ready').
 */
export async function POST(request: NextRequest) {
  const rateLimited = await enforcePaidRateLimit(request);
  if (rateLimited) return rateLimited;

  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };

  const consentBlocked = await requireActiveConsent(user.id);
  if (consentBlocked) return consentBlocked;

  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const parsed = schema.safeParse(parsedJson.body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { voiceId, prompt, aspectRatio } = parsed.data;

  const [row] = await db
    .select({
      id: familyVoices.id,
      userId: familyVoices.userId,
      loraStatus: familyVoices.loraStatus,
      loraDestination: familyVoices.loraDestination,
      loraVersion: familyVoices.loraVersion,
      loraTriggerWord: familyVoices.loraTriggerWord,
    })
    .from(familyVoices)
    .where(and(eq(familyVoices.id, voiceId), voiceOwnedBy(user.id)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Voice not found" }, { status: 404 });

  if (
    row.loraStatus !== "ready" ||
    !row.loraDestination ||
    !row.loraVersion ||
    !row.loraTriggerWord
  ) {
    return NextResponse.json(
      {
        error: "Character LoRA is not ready yet. Train it via /api/avatar/train.",
        status: row.loraStatus ?? "not_started",
      },
      { status: 409 }
    );
  }

  try {
    const outputUrl = await runPixarLoraInference({
      destination: row.loraDestination,
      version: row.loraVersion,
      triggerWord: row.loraTriggerWord,
      prompt,
      aspectRatio,
    });

    // Persist locally so subsequent loads don't re-fetch from Replicate's CDN.
    let pixarUrl = outputUrl;
    if (outputUrl.startsWith("http")) {
      const response = await fetch(outputUrl);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const uploadsDir = UPLOADS_DIR;
        await fs.mkdir(uploadsDir, { recursive: true });
        const filename = `pixar_lora_${voiceId}_${Date.now()}.png`;
        await fs.writeFile(path.join(uploadsDir, filename), buffer);
        pixarUrl = `/uploads/${filename}`;
      }
    }

    await db
      .update(familyVoices)
      .set({
        avatarUrl: pixarUrl,
        idleVideoUrl: pixarUrl,
        talkingVideoUrl: pixarUrl,
      })
      .where(eq(familyVoices.id, voiceId));

    await db.update(users).set({ avatarUrl: pixarUrl }).where(selfUser(user.id));

    return NextResponse.json({ success: true, avatarUrl: pixarUrl });
  } catch (error: any) {
    logger.error("pixar_lora_inference_failed", {
      voiceId,
      userId: user.id,
      message: error?.message ?? "Unknown error",
    });
    return NextResponse.json(
      { error: "Pixar generation failed", details: error?.message },
      { status: 502 }
    );
  }
}
