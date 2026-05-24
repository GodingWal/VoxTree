import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cloneVoice } from "@/lib/elevenlabs";
import { getPresignedDownloadUrl, GCP_PATHS } from "@/lib/gcp";
import { NextResponse } from "next/server";
import { z } from "zod";

const processSchema = z.object({
  voiceId: z.string().uuid(),
});

/**
 * Process a voice cloning request after audio has been uploaded to S3.
 * Authenticates the caller and operates as the signed-in user — never trust
 * a userId supplied in the body.
 */
export async function POST(request: Request) {
  const supabase = getRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  const parsed = processSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { voiceId } = parsed.data;
  const userId = user.id;

  // Verify the voice record exists and belongs to the caller. RLS already
  // restricts the user-scoped client; the explicit check keeps the error
  // message clean.
  const { data: voice } = await supabase
    .from("family_voices")
    .select("id, name, user_id")
    .eq("id", voiceId)
    .single();

  if (!voice || voice.user_id !== userId) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  // ElevenLabs upload + status writes use the admin client so RLS doesn't
  // block the post-success update path under any custom policy.
  const admin = createAdminClient();

  try {
    const gcpKey = GCP_PATHS.voiceSample(userId, voiceId);
    const downloadUrl = await getPresignedDownloadUrl(gcpKey);
    const audioResponse = await fetch(downloadUrl);
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    const elevenlabsVoiceId = await cloneVoice(audioBuffer, voice.name);

    await admin
      .from("family_voices")
      .update({
        elevenlabs_voice_id: elevenlabsVoiceId,
        sample_audio_url: gcpKey,
        status: "ready",
      })
      .eq("id", voiceId);

    return NextResponse.json({
      status: "ready",
      elevenlabsVoiceId,
    });
  } catch (error) {
    await admin
      .from("family_voices")
      .update({ status: "failed" })
      .eq("id", voiceId);

    return NextResponse.json(
      {
        error: "Voice cloning failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
