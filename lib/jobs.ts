import { adminClient } from "@/lib/supabase/admin";
import { generateSpeech } from "@/lib/elevenlabs";
import { S3_PATHS } from "@/lib/aws";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";


function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Process a clip generation job.
 * In production, this would be invoked by a Lambda, BullMQ worker, or similar.
 * For now, it runs inline after the clip record is created.
 */
export async function processClipJob(clipId: string): Promise<void> {
  // Get clip details
  const { data: clip } = await adminClient
    .from("generated_clips")
    .select("*, family_voices(elevenlabs_voice_id), content_library(original_video_url, title)")
    .eq("id", clipId)
    .single();

  if (!clip) return;

  const voiceData = clip.family_voices as Record<string, unknown> | null;
  const contentData = clip.content_library as Record<string, unknown> | null;
  const elevenlabsVoiceId = voiceData?.elevenlabs_voice_id as string | null;

  if (!elevenlabsVoiceId) {
    await adminClient
      .from("generated_clips")
      .update({ status: "failed" })
      .eq("id", clipId);
    return;
  }

  // Update to processing
  await adminClient
    .from("generated_clips")
    .update({ status: "processing" })
    .eq("id", clipId);

  try {
    // Generate narration audio via ElevenLabs
    // In production, we'd extract/transcribe the original audio first
    const narrationText = `This is a narration for ${(contentData?.title as string) ?? "this content"}.`;
    const audioBuffer = await generateSpeech(elevenlabsVoiceId, narrationText);

    // Upload audio to S3
    const s3 = getS3Client();
    const audioKey = S3_PATHS.clipAudio(clip.user_id, clip.content_id, clip.voice_id);
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: audioKey,
        Body: audioBuffer,
        ContentType: "audio/mpeg",
      })
    );

    // Build output URL
    const cloudFrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
    const audioUrl = cloudFrontDomain
      ? `https://${cloudFrontDomain}/${audioKey}`
      : `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${audioKey}`;

    // Mark as ready
    await adminClient
      .from("generated_clips")
      .update({
        status: "ready",
        output_audio_url: audioUrl,
        cached: true,
      })
      .eq("id", clipId);
  } catch {
    await adminClient
      .from("generated_clips")
      .update({ status: "failed" })
      .eq("id", clipId);
  }
}
