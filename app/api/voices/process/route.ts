import { createClient } from "@supabase/supabase-js";
import { cloneVoice } from "@/lib/elevenlabs";
import { getPresignedDownloadUrl, S3_PATHS } from "@/lib/aws";
import { NextResponse } from "next/server";
import { z } from "zod";

const processSchema = z.object({
  voiceId: z.string().uuid(),
  userId: z.string().uuid(),
});

/**
 * Process a voice cloning request after audio has been uploaded to S3.
 * Called by the client after a successful upload, or by a webhook.
 */
export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const parsed = processSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { voiceId, userId } = parsed.data;

  // Verify the voice record exists and belongs to the user
  const { data: voice } = await supabase
    .from("family_voices")
    .select("*")
    .eq("id", voiceId)
    .eq("user_id", userId)
    .single();

  if (!voice) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  try {
    // Download audio from S3
    const s3Key = S3_PATHS.voiceSample(userId, voiceId);
    const downloadUrl = await getPresignedDownloadUrl(s3Key);
    const audioResponse = await fetch(downloadUrl);
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    // Clone voice via ElevenLabs
    const elevenlabsVoiceId = await cloneVoice(audioBuffer, voice.name);

    // Update voice record with ElevenLabs voice ID
    await supabase
      .from("family_voices")
      .update({
        elevenlabs_voice_id: elevenlabsVoiceId,
        sample_audio_url: downloadUrl,
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
