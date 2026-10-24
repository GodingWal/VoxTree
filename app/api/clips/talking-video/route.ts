import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { enforcePaidRateLimit, safeJson } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth/session";
import { voiceOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import { familyVoices, generatedClips } from "@/lib/db/schema";
import { requireActiveConsent } from "@/lib/consent";
import { logger } from "@/lib/logger";
import { localMediaPath } from "@/lib/uploads";
import { generateSpeech } from "@/lib/voice-provider";
import {
  createTalkingVideo,
  isHedraConfigured,
  uploadAsset,
} from "@/lib/hedra";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

const schema = z.object({
  voiceId: z.string().uuid(),
  text: z.string().min(2).max(1000),
  aspectRatio: z.enum(["1:1", "16:9", "9:16"]).optional(),
  resolution: z.enum(["540p", "720p"]).optional(),
});

/**
 * Generate a talking-head video of a family member's Pixar clone speaking the
 * given text. Chatterbox renders the audio with the cloned voice; Hedra
 * Character-3 then drives the Pixar still with that audio.
 *
 * The endpoint returns a Hedra generation ID immediately; the client polls
 * GET /api/clips/talking-video/status until the video URL is ready.
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
  const { voiceId, text, aspectRatio, resolution } = parsed.data;

  const [voice] = await db
    .select({
      id: familyVoices.id,
      providerVoiceId: familyVoices.providerVoiceId,
      avatarUrl: familyVoices.avatarUrl,
      userId: familyVoices.userId,
    })
    .from(familyVoices)
    .where(and(eq(familyVoices.id, voiceId), voiceOwnedBy(user.id)))
    .limit(1);
  if (!voice) return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  if (!voice.providerVoiceId) {
    return NextResponse.json(
      { error: "Voice clone is not ready (missing provider_voice_id)." },
      { status: 409 }
    );
  }
  if (!voice.avatarUrl) {
    return NextResponse.json(
      { error: "Pixar avatar is required before generating a talking video." },
      { status: 409 }
    );
  }

  if (!isHedraConfigured()) {
    logger.warn("hedra_not_configured", { voiceId });
  }

  // Create a clip row up front so the UI can poll by clip id if needed.
  let clip: { id: string } | undefined;
  let clipErr: unknown = null;
  try {
    [clip] = await db
      .insert(generatedClips)
      .values({
        userId: user.id,
        voiceId,
        status: "queued",
      })
      .returning({ id: generatedClips.id });
  } catch (e) {
    clipErr = e;
  }
  if (clipErr || !clip) {
    return NextResponse.json(
      {
        error: "Failed to create clip record",
        details: clipErr instanceof Error ? clipErr.message : undefined,
      },
      { status: 500 }
    );
  }

  try {
    // 1) Render the speech audio with the cloned voice.
    const audio = await generateSpeech(voice.providerVoiceId, text);
    if (audio.length === 0) {
      // The voice service returned no audio — surface a useful error
      // instead of sending an empty buffer to Hedra (which would 400).
      await db
        .update(generatedClips)
        .set({ status: "failed" })
        .where(eq(generatedClips.id, clip.id));
      return NextResponse.json(
        {
          error:
            "Voice service returned no audio. Check that the Chatterbox voice service is running (CHATTERBOX_SERVICE_URL).",
          simulated: true,
        },
        { status: 503 }
      );
    }

    // 2) Read the Pixar still — fetch over http if remote, read locally
    // otherwise — and resolve a content type.
    let imageBuffer: Buffer;
    let imageContentType = "image/png";
    let imageFilename = "avatar.png";
    if (voice.avatarUrl.startsWith("http")) {
      const res = await fetch(voice.avatarUrl);
      if (!res.ok) throw new Error(`avatar fetch failed: ${res.status}`);
      imageBuffer = Buffer.from(await res.arrayBuffer());
      imageContentType = res.headers.get("content-type") ?? "image/png";
      imageFilename = path.basename(new URL(voice.avatarUrl).pathname) || imageFilename;
    } else {
      const localPath = localMediaPath(voice.avatarUrl);
      imageBuffer = await fs.readFile(localPath);
      const ext = path.extname(localPath).toLowerCase();
      imageContentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
      imageFilename = path.basename(localPath);
    }

    // 3) Push audio + image into Hedra, then kick off Character-3 generation.
    const [audioAssetId, imageAssetId] = await Promise.all([
      uploadAsset(audio, "audio", `voice-${voiceId}.mp3`, "audio/mpeg"),
      uploadAsset(imageBuffer, "image", imageFilename, imageContentType),
    ]);

    const generation = await createTalkingVideo({
      imageAssetId,
      audioAssetId,
      aspectRatio,
      resolution,
    });

    await db
      .update(generatedClips)
      .set({
        status: "processing",
        hedraGenerationId: generation.generationId,
      })
      .where(eq(generatedClips.id, clip.id));

    return NextResponse.json({
      clipId: clip.id,
      generationId: generation.generationId,
      status: "processing",
    });
  } catch (error: any) {
    logger.error("talking_video_generation_failed", {
      voiceId,
      userId: user.id,
      clipId: clip.id,
      message: error?.message ?? "Unknown error",
    });
    await db
      .update(generatedClips)
      .set({ status: "failed" })
      .where(eq(generatedClips.id, clip.id));

    return NextResponse.json(
      { error: "Talking video generation failed", details: error?.message },
      { status: 502 }
    );
  }
}
