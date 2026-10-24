import { and, arrayContains, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contentLibrary, familyVoices } from "@/lib/db/schema";
import { toSnakeRows } from "@/lib/db/to-snake";
import { getCurrentUserId } from "@/lib/auth/session";
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

  // RLS: content_library is readable by any authenticated user (and this
  // page historically rendered for anonymous visitors too).
  const conditions = [];
  if (ageFilter) conditions.push(eq(contentLibrary.ageRange, ageFilter));
  if (tagFilter) conditions.push(arrayContains(contentLibrary.tags, [tagFilter]));

  const rawContent = await db
    .select()
    .from(contentLibrary)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contentLibrary.createdAt));

  // NOTE: `curriculum` is not a column in the schema (it never existed on
  // content_library — PostgREST errored on the eq filter and the page saw
  // an empty list whenever a curriculum filter was set). Expose it as
  // null and apply the filter below, preserving that observable result.
  let content = toSnakeRows(rawContent).map((row) => ({
    ...row,
    curriculum: null as string | null,
  })) as unknown as ContentItem[];
  if (curriculumFilter) {
    content = content.filter((c) => c.curriculum === curriculumFilter);
  }

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
  const userId = await getCurrentUserId();
  if (userId) {
    // RLS owner policy: user_id = uid. `relation` never existed on
    // family_voices (the old select errored and always returned no
    // voices); expose it as null to keep the prop shape while returning
    // the user's real ready voices.
    const voiceData = await db
      .select({
        id: familyVoices.id,
        name: familyVoices.name,
        status: familyVoices.status,
      })
      .from(familyVoices)
      .where(and(eq(familyVoices.userId, userId), eq(familyVoices.status, "ready")))
      .orderBy(desc(familyVoices.createdAt));
    voices = voiceData.map((row) => ({ ...row, relation: null }));
  }

  return (
    <BrowseClient
      initialStories={content}
      voices={voices}
    />
  );
}
