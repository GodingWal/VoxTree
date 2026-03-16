import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cloneVoice } from "@/lib/elevenlabs";
import { getPresignedDownloadUrl, S3_PATHS } from "@/lib/aws";
import { NextResponse } from "next/server";
import { z } from "zod";

const processSchema = z.object({
  voiceId: z.string().uuid(),
});

/**
 * Process a voice cloning request after audio has been uploaded to S3.
 * Called by the client after a successful upload.
 */
export async function POST(request: Request) {
  // Authenticate the request — only the voice owner may trigger processing
  const supabaseUser = createServerClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
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
  const supabase = createAdminClient();

  // Verify the voice record exists and belongs to the authenticated user
  const { data: voice } = await supabase
    .from("family_voices")
    .select("*")
    .eq("id", voiceId)
    .eq("user_id", user.id)
    .single();

  if (!voice) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  try {
    // Download audio from S3 using a temporary presigned URL
    const s3Key = S3_PATHS.voiceSample(user.id, voiceId);
    const downloadUrl = await getPresignedDownloadUrl(s3Key);
    const audioResponse = await fetch(downloadUrl);
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    // Clone voice via ElevenLabs
    const elevenlabsVoiceId = await cloneVoice(audioBuffer, voice.name);

    // Store the permanent S3 key (not the expiring presigned URL)
    await supabase
      .from("family_voices")
      .update({
        elevenlabs_voice_id: elevenlabsVoiceId,
        sample_audio_url: s3Key,
        status: "ready",
      })
      .eq("id", voiceId);

    return NextResponse.json({
      status: "ready",
      elevenlabsVoiceId,
    });
  } catch (error) {
    // Mark voice as failed
    await supabase
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
