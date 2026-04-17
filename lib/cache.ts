import { createAdminClient } from "./supabase/admin";
import { getCloudFrontUrl, S3_PATHS } from "./aws";

/**
 * Check if audio has already been generated for a content + voice combination.
 * Returns the CloudFront URL if cached, null otherwise.
 */
export async function getCachedAudio(
  contentId: string,
  voiceId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("generated_clips")
    .select("output_video_url")
    .eq("content_id", contentId)
    .eq("voice_id", voiceId)
    .eq("status", "ready")
    .eq("cached", true)
    .limit(1)
    .single();

  return data?.output_video_url ?? null;
}

/**
 * Store a generated clip in S3 and mark it as cached in the database.
 * Returns the CloudFront URL for the cached clip.
 */
export async function markAsCached(
  clipId: string,
  userId: string,
  contentId: string,
  voiceId: string
): Promise<string> {
  const supabase = createAdminClient();
  const videoKey = S3_PATHS.clipVideo(userId, contentId, voiceId);
  const cloudFrontUrl = getCloudFrontUrl(videoKey);

  await supabase
    .from("generated_clips")
    .update({
      cached: true,
      output_video_url: cloudFrontUrl,
      status: "ready",
    })
    .eq("id", clipId);

  return cloudFrontUrl;
}
