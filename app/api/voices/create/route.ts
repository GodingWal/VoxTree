import { getRouteClient } from "@/lib/supabase/auth";
import { checkLimit } from "@/lib/limits";
import { getPresignedUploadUrl, S3_PATHS } from "@/lib/aws";
import { NextResponse } from "next/server";
import { z } from "zod";

const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
] as const;

const createVoiceSchema = z.object({
  name: z.string().min(1).max(100),
  contentType: z
    .string()
    .refine((t) => (ALLOWED_AUDIO_TYPES as readonly string[]).includes(t), {
      message: "Unsupported audio content type",
    })
    .optional(),
});

export async function POST(request: Request) {
  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createVoiceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Check voice slot limit
  const limitCheck = await checkLimit(user.id, "add_voice");
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: limitCheck.reason,
        upgradeRequired: true,
        upgradePrompt: limitCheck.upgradePrompt,
      },
      { status: 403 }
    );
  }

  // Create voice record
  const { data: voice, error: insertError } = await supabase
    .from("family_voices")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      status: "processing",
    })
    .select()
    .single();

  if (insertError || !voice) {
    return NextResponse.json(
      { error: "Failed to create voice record" },
      { status: 500 }
    );
  }

  // Generate presigned upload URL — the client must PUT with the same
  // Content-Type, so accept the client's content type when provided.
  const s3Key = S3_PATHS.voiceSample(user.id, voice.id);
  const contentType = parsed.data.contentType ?? "audio/mpeg";
  const uploadUrl = await getPresignedUploadUrl(s3Key, contentType);

  // Increment voice slots used
  await supabase.rpc("increment_voice_slots", { user_id: user.id });

  return NextResponse.json({
    voiceId: voice.id,
    uploadUrl,
    s3Key,
  });
}
