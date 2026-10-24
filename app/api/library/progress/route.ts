import { NextResponse } from "next/server";

import { safeJson } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth/session";
import { progressOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import { userStoryProgress } from "@/lib/db/schema";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };

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

  await db
    .insert(userStoryProgress)
    .values({
      userId: user.id,
      contentId,
      progressSeconds,
      completed: !!completed,
      lastPlayedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userStoryProgress.userId, userStoryProgress.contentId],
      set: {
        progressSeconds,
        completed: !!completed,
        lastPlayedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };

  const data = await db
    .select({
      contentId: userStoryProgress.contentId,
      progressSeconds: userStoryProgress.progressSeconds,
      completed: userStoryProgress.completed,
    })
    .from(userStoryProgress)
    .where(progressOwnedBy(user.id));

  // Response keys stay snake_case, as PostgREST returned them.
  return NextResponse.json({
    progress: data.map((row) => ({
      content_id: row.contentId,
      progress_seconds: row.progressSeconds,
      completed: row.completed,
    })),
  });
}
