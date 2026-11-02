import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/session";
import { voiceOwnedBy } from "@/lib/authz";
import { hasActiveConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import { familyVoices } from "@/lib/db/schema";
import { convertSpeech } from "@/lib/voice-provider";

const testVoiceSchema = z.object({
  voiceId: z.string().uuid(),
  // SeedVC converts a source performance — a test now means converting
  // a supplied recording of a reading into the cloned voice. There is
  // no text-only test anymore (the engine has no TTS path).
  sourceAudioBase64: z.string().min(1).optional(),
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

  const { voiceId, sourceAudioBase64 } = parsed.data;

  if (!sourceAudioBase64) {
    return NextResponse.json(
      {
        error:
          "seedvc_requires_source_audio: SeedVC converts a source performance; supply sourceAudioBase64 (a short recording of a reading) to test this voice",
        code: "seedvc_requires_source_audio",
      },
      { status: 422 }
    );
  }

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
    // Convert the supplied source reading into the cloned voice.
    const audioBuffer = await convertSpeech(
      voice.providerVoiceId,
      Buffer.from(sourceAudioBase64, "base64")
    );

    if (audioBuffer.length === 0) {
      throw new Error("Voice service returned empty audio");
    }

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/wav",
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
