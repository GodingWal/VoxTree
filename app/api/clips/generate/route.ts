import { getRouteClient } from "@/lib/supabase/auth";
import { checkLimit } from "@/lib/limits";
import { getCachedAudio } from "@/lib/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const generateSchema = z.object({
  contentId: z.string().uuid(),
  voiceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
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
