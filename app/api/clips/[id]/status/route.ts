import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { generatedClips } from "@/lib/db/schema";
import { getPresignedDownloadUrl } from "@/lib/gcp";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clipId } = await params;
  if (!clipId) {
    return NextResponse.json({ error: "Missing clip ID" }, { status: 400 });
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = { id: userId };

  // Fetch the clip record
  let clip: typeof generatedClips.$inferSelect | undefined;
  try {
    [clip] = await db
      .select()
      .from(generatedClips)
      .where(eq(generatedClips.id, clipId))
      .limit(1);
  } catch {
    clip = undefined;
  }

  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  // Check user ownership
  if (clip.userId !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // If status is ready, resolve the presigned download URL
  let downloadUrl = null;
  if (clip.status === "ready") {
    const key = clip.outputAudioUrl || clip.outputVideoUrl;
    if (key) {
      if (key.startsWith("http")) {
        downloadUrl = key;
      } else {
        downloadUrl = await getPresignedDownloadUrl(key);
      }
    }
  }

  return NextResponse.json({
    status: clip.status,
    url: downloadUrl,
  });
}
