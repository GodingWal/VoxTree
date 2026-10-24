import { and, eq } from "drizzle-orm";

import { db } from "./db";
import { generatedClips } from "./db/schema";
import { getPublicUrl, GCP_PATHS } from "./gcp";

/**
 * Check if audio has already been generated for a content + voice combination.
 * Returns the public URL if cached, null otherwise.
 *
 * This is a cache lookup across users by design (it ran on the
 * service-role client before the local-stack migration): a ready, cached clip
 * for the same content+voice pair is reusable regardless of who asks.
 */
export async function getCachedAudio(
  contentId: string,
  voiceId: string
): Promise<string | null> {
  const [row] = await db
    .select({ outputVideoUrl: generatedClips.outputVideoUrl })
    .from(generatedClips)
    .where(
      and(
        eq(generatedClips.contentId, contentId),
        eq(generatedClips.voiceId, voiceId),
        eq(generatedClips.status, "ready"),
        eq(generatedClips.cached, true)
      )
    )
    .limit(1);

  return row?.outputVideoUrl ?? null;
}

/**
 * Store a generated clip in GCS and mark it as cached in the database.
 * Returns the public URL for the cached clip.
 */
export async function markAsCached(
  clipId: string,
  userId: string,
  contentId: string,
  voiceId: string
): Promise<string> {
  const videoKey = GCP_PATHS.clipVideo(userId, contentId, voiceId);
  const publicUrl = getPublicUrl(videoKey);

  await db
    .update(generatedClips)
    .set({
      cached: true,
      outputVideoUrl: publicUrl,
      status: "ready",
    })
    .where(eq(generatedClips.id, clipId));

  return publicUrl;
}
