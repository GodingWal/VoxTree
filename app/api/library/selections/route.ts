import { getRouteClient } from "@/lib/supabase/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storyIds } = await request.json();
  if (!Array.isArray(storyIds)) {
    return NextResponse.json({ error: "storyIds must be an array" }, { status: 400 });
  }

  // Get current saved stories
  const { data: existing } = await supabase
    .from("user_saved_stories")
    .select("content_id")
    .eq("user_id", user.id);

  const existingIds = new Set((existing ?? []).map(r => r.content_id));
  const targetIds = new Set(storyIds as string[]);

  // Insert new selections
  const toInsert = storyIds.filter((id: string) => !existingIds.has(id));
  if (toInsert.length > 0) {
    await supabase.from("user_saved_stories").insert(
      toInsert.map((id: string) => ({ user_id: user.id, content_id: id }))
    );
  }

  // Remove deselected
  const toDelete = [...existingIds].filter(id => !targetIds.has(id));
  if (toDelete.length > 0) {
    await supabase
      .from("user_saved_stories")
      .delete()
      .eq("user_id", user.id)
      .in("content_id", toDelete);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_saved_stories")
    .select("content_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ storyIds: (data ?? []).map(r => r.content_id) });
}
