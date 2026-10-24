import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth/session";
import { voiceOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import { familyVoices } from "@/lib/db/schema";

/**
 * Check the current avatar_url for a voice clone.
 * Used by the client to poll for Pixar avatar generation completion.
 */
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };

  const voiceId = request.nextUrl.searchParams.get("voiceId");
  if (!voiceId) return NextResponse.json({ error: "voiceId required" }, { status: 400 });

  const [data] = await db
    .select({ avatarUrl: familyVoices.avatarUrl })
    .from(familyVoices)
    .where(and(eq(familyVoices.id, voiceId), voiceOwnedBy(user.id)))
    .limit(1);

  return NextResponse.json({ avatarUrl: data?.avatarUrl || null });
}
