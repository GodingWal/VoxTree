import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { checkLimit } from "@/lib/limits";
import { NextResponse } from "next/server";
import { z } from "zod";

const createVoiceSchema = z.object({
  name: z.string().min(1).max(100),
});

const hasAwsConfig =
  !!process.env.AWS_ACCESS_KEY_ID &&
  !!process.env.AWS_SECRET_ACCESS_KEY &&
  !!process.env.AWS_S3_BUCKET;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure the user profile row exists
  await adminClient
    .from("users")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  const body = await request.json();
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

  // Increment voice slots used
  await adminClient.rpc("increment_voice_slots", { p_user_id: user.id });

  if (hasAwsConfig) {
    // Use S3 presigned upload URL
    try {
      const { getPresignedUploadUrl, S3_PATHS } = await import("@/lib/aws");
      const s3Key = S3_PATHS.voiceSample(user.id, voice.id);
      const uploadUrl = await getPresignedUploadUrl(s3Key, "audio/mpeg");

      return NextResponse.json({
        voiceId: voice.id,
        uploadUrl,
        s3Key,
        uploadMode: "s3",
      });
    } catch (err) {
      console.error("S3 presigned URL failed, falling back to direct upload:", err);
    }
  }

  // Fallback: client will upload directly via /api/voices/upload
  return NextResponse.json({
    voiceId: voice.id,
    uploadMode: "direct",
  });
}
