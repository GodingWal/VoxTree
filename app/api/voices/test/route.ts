import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/session";
import { voiceOwnedBy } from "@/lib/authz";
import { hasActiveConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import { familyVoices } from "@/lib/db/schema";
import { generateSpeech } from "@/lib/voice-provider";

const testVoiceSchema = z.object({
  voiceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = { id: userId };

  if (!(await hasActiveConsent(user.id))) {
    return NextResponse.json({ error: "Active parental consent is required.", consentRequired: true }, { status: 403 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    } else {
      body = {};
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = testVoiceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { voiceId } = parsed.data;

  // Owner-scoped: this query previously relied on the family_voices RLS
  // select policy to hide other users' voices (a miss read as "not ready").
  const [voice] = await db
    .select({
      providerVoiceId: familyVoices.providerVoiceId,
      name: familyVoices.name,
    })
    .from(familyVoices)
    .where(and(eq(familyVoices.id, voiceId), voiceOwnedBy(user.id)))
    .limit(1);

  if (!voice || !voice.providerVoiceId) {
    return NextResponse.json({ error: "Voice not ready" }, { status: 400 });
  }

  try {
    // Generate a quick test sentence
    const audioBuffer = await generateSpeech(
      voice.providerVoiceId,
      `Hello! I am ${voice.name}, and this is a sample of my reading voice.`
    );

    if (audioBuffer.length === 0) {
      throw new Error("Voice service returned empty audio");
    }

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("Test voice generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate test audio",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
