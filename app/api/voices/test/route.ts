import { getRouteClient } from "@/lib/supabase/auth";
import { generateSpeech } from "@/lib/elevenlabs";
import { NextResponse } from "next/server";
import { z } from "zod";

const testVoiceSchema = z.object({
  voiceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = getRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const { data: voice } = await supabase
    .from("family_voices")
    .select("elevenlabs_voice_id, name")
    .eq("id", voiceId)
    .single();

  if (!voice || !voice.elevenlabs_voice_id) {
    return NextResponse.json({ error: "Voice not ready" }, { status: 400 });
  }

  try {
    // Generate a quick test sentence
    const audioBuffer = await generateSpeech(
      voice.elevenlabs_voice_id,
      `Hello! I am ${voice.name}, and this is a sample of my reading voice.`
    );

    if (audioBuffer.length === 0) {
      // Simulated environment fallback
      return NextResponse.json({ simulated: true });
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
