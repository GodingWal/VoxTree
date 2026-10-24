import { and, asc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { safeJson } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth/session";
import { savedStoryOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import { userSavedStories } from "@/lib/db/schema";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };

  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const body = parsedJson.body as { storyIds?: unknown };
  const storyIds = body.storyIds;
  if (!Array.isArray(storyIds) || !storyIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "storyIds must be an array of strings" }, { status: 400 });
  }

  // Get current saved stories
  const existing = await db
    .select({ contentId: userSavedStories.contentId })
    .from(userSavedStories)
    .where(savedStoryOwnedBy(user.id));

  const existingIds = new Set(existing.map(r => r.contentId));
  const targetIds = new Set(storyIds as string[]);

  // Insert new selections
  const toInsert = storyIds.filter((id: string) => !existingIds.has(id));
  if (toInsert.length > 0) {
    await db.insert(userSavedStories).values(
      toInsert.map((id: string) => ({ userId: user.id, contentId: id }))
    );
  }

  // Remove deselected
  const toDelete = [...existingIds].filter(id => !targetIds.has(id));
  if (toDelete.length > 0) {
    await db
      .delete(userSavedStories)
      .where(and(savedStoryOwnedBy(user.id), inArray(userSavedStories.contentId, toDelete)));
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };

  const data = await db
    .select({ contentId: userSavedStories.contentId })
    .from(userSavedStories)
    .where(savedStoryOwnedBy(user.id))
    .orderBy(asc(userSavedStories.createdAt));

  return NextResponse.json({ storyIds: data.map(r => r.contentId) });
}
