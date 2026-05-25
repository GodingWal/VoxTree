import { createClient } from "@/lib/supabase/server";
import { BrowseClient } from "./browse-client";

type ContentItem = {
  id: string;
  title: string;
  series: string | null;
  episode_number: number | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  age_range: string | null;
  tags: string[];
  is_premium: boolean;
  content_type: string;
  synopsis: string | null;
};

type Voice = {
  id: string;
  name: string;
  status: string;
  relation?: string | null;
};

export default async function BrowsePage() {
  const supabase = createClient();

  const { data: rawContent } = await supabase
    .from("content_library")
    .select("*")
    .order("created_at", { ascending: false });

  const content = (rawContent ?? []) as ContentItem[];

  // Fetch voices for inline player (if user is logged in)
  let voices: Voice[] = [];
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: voiceData } = await supabase
      .from("family_voices")
      .select("id, name, status, relation")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false });
    voices = voiceData ?? [];
  }

  return <BrowseClient initialStories={content} voices={voices} />;
}
