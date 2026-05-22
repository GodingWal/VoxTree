import { getRouteClient } from "@/lib/supabase/auth";
import { checkLimit } from "@/lib/limits";
import { getCachedAudio } from "@/lib/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const generateSchema = z.object({
  contentId: z.string().uuid(),
  voiceId: z.string().uuid(),
});

import { RateLimit } from "@/lib/rate-limit";

const rateLimiter = new RateLimit({ limit: 5, windowMs: 60000 });

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    } else {
      body = {};
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = generateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { contentId, voiceId } = parsed.data;

  // Check clip generation limit (clips count against the videos limit)
  const limitCheck = await checkLimit(user.id, "add_video");
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: limitCheck.reason,
        upgradeRequired: true,
        upgradePrompt: limitCheck.upgradePrompt,
      },
      { status: 403 }
    );
  }

  // Fetch the content details to determine mode
  const { data: content, error: contentError } = await supabase
    .from("content_library")
    .select("content_mode, text_script, isolated_vocals_url, instrumental_url, original_video_url")
    .eq("id", contentId)
    .single();

  if (contentError || !content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  // Check cache first
  const cachedUrl = await getCachedAudio(contentId, voiceId);
  if (cachedUrl) {
    return NextResponse.json({
      status: "ready",
      videoUrl: cachedUrl,
      cached: true,
    });
  }

  // Create a clip record in queued status
  const { data: clip, error: insertError } = await supabase
    .from("generated_clips")
    .insert({
      user_id: user.id,
      content_id: contentId,
      voice_id: voiceId,
      status: "queued",
    })
    .select()
    .single();

  if (insertError || !clip) {
    return NextResponse.json(
      { error: "Failed to create clip record" },
      { status: 500 }
    );
  }

  // TODO: Invoke Lambda or background worker for ffmpeg processing
  if (content.content_mode === "tts") {
    // 1. Check if text_script is available
    // 2. Fetch elevenlabs_voice_id from family_voices
    // 3. Call generateSpeech() via lib/elevenlabs
    // 4. Mix speech with instrumental_url / original_video_url via ffmpeg
    console.log(`[Clip Generation] Triggering TTS workflow for clip ${clip.id}`);
  } else if (content.content_mode === "v2v") {
    // 1. Check if isolated_vocals_url is available
    // 2. Fetch rvc_model_id from family_voices
    // 3. Send isolated_vocals_url and rvc_model_id to GPU worker (e.g., Replicate)
    // 4. Wait for webhook, mix returned vocals with instrumental_url via ffmpeg
    console.log(`[Clip Generation] Triggering V2V (RVC) workflow for clip ${clip.id}`);
  }

  // For now, return the clip ID for status polling

  return NextResponse.json({
    clipId: clip.id,
    status: "queued",
  });
}
