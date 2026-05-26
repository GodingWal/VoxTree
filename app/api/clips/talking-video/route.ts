import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforcePaidRateLimit, safeJson } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { generateSpeech } from "@/lib/elevenlabs";
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
 * given text. ElevenLabs renders the audio with the cloned voice; Hedra
 * Character-3 then drives the Pixar still with that audio.
 *
 * The endpoint returns a Hedra generation ID immediately; the client polls
 * GET /api/clips/talking-video/status until the video URL is ready.
 */
export async function POST(request: NextRequest) {
  const rateLimited = enforcePaidRateLimit(request);
  if (rateLimited) return rateLimited;

  const supabase = getRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const { data: voice } = await supabase
    .from("family_voices")
    .select("id, elevenlabs_voice_id, avatar_url, user_id")
    .eq("id", voiceId)
    .eq("user_id", user.id)
    .single();
  if (!voice) return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  if (!voice.elevenlabs_voice_id) {
    return NextResponse.json(
      { error: "Voice clone is not ready (missing elevenlabs_voice_id)." },
      { status: 409 }
    );
  }
  if (!voice.avatar_url) {
    return NextResponse.json(
      { error: "Pixar avatar is required before generating a talking video." },
      { status: 409 }
    );
  }

  if (!isHedraConfigured()) {
    logger.warn("hedra_not_configured", { voiceId });
  }

  // Create a clip row up front so the UI can poll by clip id if needed.
  const admin = createAdminClient();
  const { data: clip, error: clipErr } = await admin
    .from("generated_clips")
    .insert({
      user_id: user.id,
      voice_id: voiceId,
      status: "queued",
    })
    .select("id")
    .single();
  if (clipErr || !clip) {
    return NextResponse.json(
      { error: "Failed to create clip record", details: clipErr?.message },
      { status: 500 }
    );
  }

  try {
    // 1) Render the speech audio with the cloned voice.
    const audio = await generateSpeech(voice.elevenlabs_voice_id, text);
    if (audio.length === 0) {
      // ElevenLabs is in simulation mode — surface a useful error instead of
      // sending an empty buffer to Hedra (which would 400).
      await admin
        .from("generated_clips")
        .update({ status: "failed" })
        .eq("id", clip.id);
      return NextResponse.json(
        {
          error:
            "ElevenLabs is in simulation mode (no API key). Configure ELEVENLABS_API_KEY to generate real audio.",
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
    if (voice.avatar_url.startsWith("http")) {
      const res = await fetch(voice.avatar_url);
      if (!res.ok) throw new Error(`avatar fetch failed: ${res.status}`);
      imageBuffer = Buffer.from(await res.arrayBuffer());
      imageContentType = res.headers.get("content-type") ?? "image/png";
      imageFilename = path.basename(new URL(voice.avatar_url).pathname) || imageFilename;
    } else {
      const localPath = path.join(process.cwd(), "public", voice.avatar_url);
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

    await admin
      .from("generated_clips")
      .update({
        status: "processing",
        hedra_generation_id: generation.generationId,
      })
      .eq("id", clip.id);

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
    await admin
      .from("generated_clips")
      .update({ status: "failed" })
      .eq("id", clip.id);

    return NextResponse.json(
      { error: "Talking video generation failed", details: error?.message },
      { status: 502 }
    );
  }
}
