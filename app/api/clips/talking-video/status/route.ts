import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTalkingVideoStatus } from "@/lib/hedra";
import { promises as fs } from "fs";
import path from "path";

/**
 * Poll the Hedra talking-video status for a given clip and, once complete,
 * persist the playable URL on the clip row + on the family_voices record.
 */
export async function GET(request: NextRequest) {
  const supabase = getRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clipId = request.nextUrl.searchParams.get("clipId");
  if (!clipId) return NextResponse.json({ error: "clipId required" }, { status: 400 });

  const { data: clip } = await supabase
    .from("generated_clips")
    .select("id, voice_id, status, hedra_generation_id, talking_video_url")
    .eq("id", clipId)
    .eq("user_id", user.id)
    .single();
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (clip.status === "ready" && clip.talking_video_url) {
    return NextResponse.json({
      status: "ready",
      videoUrl: clip.talking_video_url,
    });
  }

  if (!clip.hedra_generation_id) {
    return NextResponse.json({ status: clip.status });
  }

  const remote = await getTalkingVideoStatus(clip.hedra_generation_id);
  const admin = createAdminClient();

  if (remote.status === "complete" && remote.videoUrl) {
    // Mirror the video locally so subsequent loads don't depend on Hedra's
    // CDN expiring. Skip for simulated URLs that don't actually exist.
    let storedUrl = remote.videoUrl;
    if (remote.videoUrl.startsWith("http")) {
      try {
        const res = await fetch(remote.videoUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const uploadsDir = path.join(process.cwd(), "public", "uploads");
          await fs.mkdir(uploadsDir, { recursive: true });
          const filename = `talking_${clip.id}.mp4`;
          await fs.writeFile(path.join(uploadsDir, filename), buf);
          storedUrl = `/uploads/${filename}`;
        }
      } catch {
        // Fall back to the remote URL — still playable for the session.
      }
    }

    await admin
      .from("generated_clips")
      .update({ status: "ready", talking_video_url: storedUrl })
      .eq("id", clip.id);

    if (clip.voice_id) {
      await admin
        .from("family_voices")
        .update({ talking_video_url: storedUrl })
        .eq("id", clip.voice_id);
    }

    return NextResponse.json({ status: "ready", videoUrl: storedUrl });
  }

  if (remote.status === "error") {
    await admin
      .from("generated_clips")
      .update({ status: "failed" })
      .eq("id", clip.id);
    return NextResponse.json({ status: "failed" });
  }

  return NextResponse.json({ status: "processing" });
}
