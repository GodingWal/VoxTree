import { NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { getPresignedDownloadUrl } from "@/lib/gcp";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const clipId = params.id;
  if (!clipId) {
    return NextResponse.json({ error: "Missing clip ID" }, { status: 400 });
  }

  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the clip record
  const { data: clip, error: fetchError } = await supabase
    .from("generated_clips")
    .select("*")
    .eq("id", clipId)
    .single();

  if (fetchError || !clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  // Check user ownership
  if (clip.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // If status is ready, resolve the presigned download URL
  let downloadUrl = null;
  if (clip.status === "ready") {
    const key = clip.output_audio_url || clip.output_video_url;
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
