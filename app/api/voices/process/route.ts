import { createClient as createAuthClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

const processSchema = z.object({
  voiceId: z.string().uuid(),
});

const hasAwsConfig =
  !!process.env.AWS_ACCESS_KEY_ID &&
  !!process.env.AWS_SECRET_ACCESS_KEY &&
  !!process.env.AWS_S3_BUCKET;

const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;

export async function POST(request: Request) {
  const authClient = createAuthClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = authUser.id;
  const body = await request.json();
  const parsed = processSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { voiceId } = parsed.data;

  // Verify the voice record exists and belongs to the user
  const { data: voice } = await adminClient
    .from("family_voices")
    .select("*")
    .eq("id", voiceId)
    .eq("user_id", userId)
    .single();

  if (!voice) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  // If ElevenLabs is not configured, mark as ready (demo mode)
  if (!hasElevenLabs) {
    await adminClient
      .from("family_voices")
      .update({ status: "ready" })
      .eq("id", voiceId);

    return NextResponse.json({
      status: "ready",
      note: "Voice marked as ready (ElevenLabs not configured - demo mode)",
    });
  }

  try {
    let audioBuffer: Buffer;

    if (hasAwsConfig) {
      // Download audio from S3
      const { getPresignedDownloadUrl, S3_PATHS } = await import("@/lib/aws");
      const s3Key = S3_PATHS.voiceSample(userId, voiceId);
      const downloadUrl = await getPresignedDownloadUrl(s3Key);
      const audioResponse = await fetch(downloadUrl);
      audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    } else if (voice.sample_audio_url) {
      // Download from Supabase Storage
      const { data, error } = await adminClient.storage
        .from("voice-samples")
        .download(voice.sample_audio_url);

      if (error || !data) {
        throw new Error("Failed to download audio from storage: " + (error?.message ?? "no data"));
      }
      audioBuffer = Buffer.from(await data.arrayBuffer());
    } else {
      throw new Error("No audio sample found for this voice profile");
    }

    // Clone voice via ElevenLabs
    const { cloneVoice } = await import("@/lib/elevenlabs");
    const elevenlabsVoiceId = await cloneVoice(audioBuffer, voice.name);

    // Update voice record
    await adminClient
      .from("family_voices")
      .update({
        elevenlabs_voice_id: elevenlabsVoiceId,
        status: "ready",
      })
      .eq("id", voiceId);

    return NextResponse.json({
      status: "ready",
      elevenlabsVoiceId,
    });
  } catch (error) {
    await adminClient
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
