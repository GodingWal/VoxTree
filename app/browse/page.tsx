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
  curriculum: string | null;
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

export default async function BrowsePage({
  searchParams,
}: {
  searchParams?: Promise<{ age?: string; tag?: string; curriculum?: string; duration?: string; q?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const ageFilter = params.age?.trim() || null;
  const tagFilter = params.tag?.trim().toLowerCase() || null;
  const curriculumFilter = params.curriculum?.trim().toLowerCase() || null;
  const durationFilter = params.duration?.trim() || null;
  const qFilter = params.q?.trim().toLowerCase() || null;

  const supabase = await createClient();

  let query = supabase.from("content_library").select("*").order("created_at", { ascending: false });

  if (ageFilter) {
    query = query.eq("age_range", ageFilter);
  }
  if (curriculumFilter) {
    query = query.eq("curriculum", curriculumFilter);
  }
  if (tagFilter) {
    query = query.contains("tags", [tagFilter]);
  }

  const { data: rawContent } = await query;

  let content = (rawContent ?? []) as ContentItem[];

  if (durationFilter) {
    if (durationFilter === "short") {
      content = content.filter((c) => c.duration_seconds != null && c.duration_seconds < 600);
    } else if (durationFilter.includes("-")) {
      const [min, max] = durationFilter.split("-").map(Number);
      content = content.filter((c) => {
        if (c.duration_seconds == null) return false;
        const m = c.duration_seconds / 60;
        return m >= (min || 0) && m <= (max || 999);
      });
    }
  }
  if (qFilter) {
    content = content.filter(
      (c) =>
        c.title.toLowerCase().includes(qFilter) ||
        (c.series ?? "").toLowerCase().includes(qFilter) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(qFilter)) ||
        (c.curriculum ?? "").toLowerCase().includes(qFilter)
    );
  }

  let voices: Voice[] = [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: voiceData } = await supabase
      .from("family_voices")
      .select("id, name, status, relation")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false });
    voices = voiceData ?? [];
  }

  return (
    <BrowseClient
      initialStories={content}
      voices={voices}
      activeFilters={{ age: ageFilter, tag: tagFilter, curriculum: curriculumFilter, duration: durationFilter, q: qFilter }}
    />
  );
}
