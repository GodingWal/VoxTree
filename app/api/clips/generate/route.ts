import { createClient } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/limits";
import { getCachedAudio } from "@/lib/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Action } from "@/lib/limits";

const generateSchema = z.object({
  contentId: z.string().uuid(),
  voiceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
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

  // Fetch the content item to determine its type and premium status
  const { data: contentItem } = await supabase
    .from("content_library")
    .select("id, content_type, is_premium")
    .eq("id", contentId)
    .single();

  if (!contentItem) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  // Check premium access if content requires it
  if (contentItem.is_premium) {
    const premiumCheck = await checkLimit(user.id, "premium_content");
    if (!premiumCheck.allowed) {
      return NextResponse.json(
        {
          error: premiumCheck.reason,
          upgradeRequired: true,
          upgradePrompt: premiumCheck.upgradePrompt,
        },
        { status: 403 }
      );
    }
  }

  // Check content-type-specific usage limit for free tier users
  const contentAction: Action =
    contentItem.content_type === "story" ? "add_story" : "add_video";

  const limitCheck = await checkLimit(user.id, contentAction);
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
  // For now, return the clip ID for status polling

  return NextResponse.json({
    clipId: clip.id,
    status: "queued",
  });
}
