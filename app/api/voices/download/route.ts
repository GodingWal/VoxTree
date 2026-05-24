import { getRouteClient } from "@/lib/supabase/auth";
import { getPresignedDownloadUrl } from "@/lib/gcp";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get("voiceId");

  if (!voiceId) {
    return NextResponse.json({ error: "Missing voiceId" }, { status: 400 });
  }

  const supabase = getRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: voice } = await supabase
    .from("family_voices")
    .select("id, sample_audio_url, user_id")
    .eq("id", voiceId)
    .single();

  if (!voice || voice.user_id !== user.id || !voice.sample_audio_url) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    let key = voice.sample_audio_url;
    // Fallback if existing record has a full URL
    if (key.startsWith("http")) {
      const url = new URL(key);
      key = url.pathname.substring(1); // remove leading slash
    }
    const downloadUrl = await getPresignedDownloadUrl(key);
    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}
