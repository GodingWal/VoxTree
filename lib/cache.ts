import { and, eq } from "drizzle-orm";

import { db } from "./db";
import { generatedClips } from "./db/schema";

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

