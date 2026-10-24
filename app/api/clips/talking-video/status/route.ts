import { and, eq } from "drizzle-orm";
import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

import { getCurrentUserId } from "@/lib/auth/session";
import { clipOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import { familyVoices, generatedClips } from "@/lib/db/schema";
import { getTalkingVideoStatus } from "@/lib/hedra";
import { UPLOADS_DIR } from "@/lib/uploads";

/**
 * Poll the Hedra talking-video status for a given clip and, once complete,
 * persist the playable URL on the clip row + on the family_voices record.
 */
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };

  const clipId = request.nextUrl.searchParams.get("clipId");
  if (!clipId) return NextResponse.json({ error: "clipId required" }, { status: 400 });

  const [clip] = await db
    .select({
      id: generatedClips.id,
      voiceId: generatedClips.voiceId,
      status: generatedClips.status,
      hedraGenerationId: generatedClips.hedraGenerationId,
      talkingVideoUrl: generatedClips.talkingVideoUrl,
    })
    .from(generatedClips)
    .where(and(eq(generatedClips.id, clipId), clipOwnedBy(user.id)))
    .limit(1);
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (clip.status === "ready" && clip.talkingVideoUrl) {
    return NextResponse.json({
      status: "ready",
      videoUrl: clip.talkingVideoUrl,
    });
  }

  if (!clip.hedraGenerationId) {
    return NextResponse.json({ status: clip.status });
  }

  const remote = await getTalkingVideoStatus(clip.hedraGenerationId);

  if (remote.status === "complete" && remote.videoUrl) {
    // Mirror the video locally so subsequent loads don't depend on Hedra's
    // CDN expiring. Skip for simulated URLs that don't actually exist.
    let storedUrl = remote.videoUrl;
    if (remote.videoUrl.startsWith("http")) {
      try {
        const res = await fetch(remote.videoUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const uploadsDir = UPLOADS_DIR;
          await fs.mkdir(uploadsDir, { recursive: true });
          const filename = `talking_${clip.id}.mp4`;
          await fs.writeFile(path.join(uploadsDir, filename), buf);
          storedUrl = `/uploads/${filename}`;
        }
      } catch {
        // Fall back to the remote URL — still playable for the session.
      }
    }

    await db
      .update(generatedClips)
      .set({ status: "ready", talkingVideoUrl: storedUrl })
      .where(eq(generatedClips.id, clip.id));

    if (clip.voiceId) {
      await db
        .update(familyVoices)
        .set({ talkingVideoUrl: storedUrl })
        .where(eq(familyVoices.id, clip.voiceId));
    }

    return NextResponse.json({ status: "ready", videoUrl: storedUrl });
  }

  if (remote.status === "error") {
    await db
      .update(generatedClips)
      .set({ status: "failed" })
      .where(eq(generatedClips.id, clip.id));
    return NextResponse.json({ status: "failed" });
  }

  return NextResponse.json({ status: "processing" });
}
