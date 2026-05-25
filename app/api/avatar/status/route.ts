import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";

/**
 * Check the current avatar_url for a voice clone.
 * Used by the client to poll for Pixar avatar generation completion.
 */
export async function GET(request: NextRequest) {
  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const voiceId = request.nextUrl.searchParams.get("voiceId");
  if (!voiceId) return NextResponse.json({ error: "voiceId required" }, { status: 400 });

  const { data } = await supabase
    .from("family_voices")
    .select("avatar_url")
    .eq("id", voiceId)
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ avatarUrl: data?.avatar_url || null });
}
