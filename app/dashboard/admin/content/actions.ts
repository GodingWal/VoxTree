"use server";

import { isAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contentLibrary } from "@/lib/db/schema";
import { revalidatePath } from "next/cache";
import type { ContentItem } from "@/types/database";

type ContentInsert = typeof contentLibrary.$inferInsert;

/**
 * Map the snake_case ContentItem payload the admin UI sends onto the
 * Drizzle columns. Unknown keys (e.g. the display-only `segments`) are
 * dropped, matching what PostgREST accepted for real columns.
 */
function toContentValues(data: Partial<Omit<ContentItem, "id" | "created_at">>): Partial<ContentInsert> {
  const values: Record<string, unknown> = {};
  if (data.title !== undefined) values.title = data.title;
  if (data.series !== undefined) values.series = data.series;
  if (data.episode_number !== undefined) values.episodeNumber = data.episode_number;
  if (data.original_video_url !== undefined) values.originalVideoUrl = data.original_video_url;
  if (data.thumbnail_url !== undefined) values.thumbnailUrl = data.thumbnail_url;
  if (data.duration_seconds !== undefined) values.durationSeconds = data.duration_seconds;
  if (data.age_range !== undefined) values.ageRange = data.age_range;
  if (data.tags !== undefined) values.tags = data.tags;
  if (data.is_premium !== undefined) values.isPremium = data.is_premium;
  if (data.content_type !== undefined) values.contentType = data.content_type;
  if (data.content_mode !== undefined) values.contentMode = data.content_mode;
  if (data.text_script !== undefined) values.textScript = data.text_script;
  if (data.isolated_vocals_url !== undefined) values.isolatedVocalsUrl = data.isolated_vocals_url;
  if (data.instrumental_url !== undefined) values.instrumentalUrl = data.instrumental_url;
  return values as Partial<ContentInsert>;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function addContent(data: Omit<ContentItem, "id" | "created_at">) {
  const user = await getCurrentUser();

  if (!user || !(await isAdmin(user.email))) {
    return { error: "Unauthorized" };
  }

  try {
    await db.insert(contentLibrary).values(toContentValues(data) as ContentInsert);
  } catch (error) {
    console.error("Error adding content:", error);
    return { error: errorMessage(error, "Failed to add content.") };
  }

  revalidatePath("/dashboard/admin/content");
  revalidatePath("/browse");
  return { success: true };
}

export async function deleteContent(id: string) {
  const user = await getCurrentUser();

  if (!user || !(await isAdmin(user.email))) {
    return { error: "Unauthorized" };
  }

  try {
    await db.delete(contentLibrary).where(eq(contentLibrary.id, id));
  } catch (error) {
    console.error("Error deleting content:", error);
    return { error: errorMessage(error, "Failed to delete content.") };
  }

  revalidatePath("/dashboard/admin/content");
  revalidatePath("/browse");
  return { success: true };
}

export async function updateContent(id: string, data: Partial<Omit<ContentItem, "id" | "created_at">>) {
  const user = await getCurrentUser();

  if (!user || !(await isAdmin(user.email))) {
    return { error: "Unauthorized" };
  }

  try {
    await db
      .update(contentLibrary)
      .set(toContentValues(data))
      .where(eq(contentLibrary.id, id));
  } catch (error) {
    console.error("Error updating content:", error);
    return { error: errorMessage(error, "Failed to update content.") };
  }

  revalidatePath("/dashboard/admin/content");
  revalidatePath("/browse");
  return { success: true };
}
