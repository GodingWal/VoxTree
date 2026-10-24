import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { familyVoices } from "@/lib/db/schema";
import { getPresignedDownloadUrl } from "@/lib/gcp";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get("voiceId");

  if (!voiceId) {
    return NextResponse.json({ error: "Missing voiceId" }, { status: 400 });
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = { id: userId };

  const [voice] = await db
    .select({
      id: familyVoices.id,
      sampleAudioKey: familyVoices.sampleAudioKey,
      userId: familyVoices.userId,
    })
    .from(familyVoices)
    .where(eq(familyVoices.id, voiceId))
    .limit(1);

  if (!voice || voice.userId !== user.id || !voice.sampleAudioKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    let key = voice.sampleAudioKey;
    // Fallback if existing record has a full URL
    if (key.startsWith("http")) {
      const url = new URL(key);
      key = url.pathname.substring(1); // remove leading slash
    }
    const downloadUrl = await getPresignedDownloadUrl(key);
    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}
