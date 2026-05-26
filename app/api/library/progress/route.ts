import { getRouteClient } from "@/lib/supabase/auth";
import { safeJson } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const { contentId, progressSeconds, completed } = parsedJson.body as {
    contentId?: unknown;
    progressSeconds?: unknown;
    completed?: unknown;
  };
  if (typeof contentId !== "string" || typeof progressSeconds !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await supabase
    .from("user_story_progress")
    .upsert(
      {
        user_id: user.id,
        content_id: contentId,
        progress_seconds: progressSeconds,
        completed: !!completed,
        last_played_at: new Date().toISOString(),
      },
      { onConflict: "user_id,content_id" }
    );

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_story_progress")
    .select("content_id, progress_seconds, completed")
    .eq("user_id", user.id);

  return NextResponse.json({ progress: data ?? [] });
}
