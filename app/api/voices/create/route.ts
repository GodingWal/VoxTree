import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { checkLimit } from "@/lib/limits";
import { getPresignedUploadUrl, S3_PATHS } from "@/lib/aws";
import { NextResponse } from "next/server";
import { z } from "zod";

const createVoiceSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure the user profile row exists (guard against trigger not having fired)
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

  // Generate presigned upload URL
  const s3Key = S3_PATHS.voiceSample(user.id, voice.id);
  const uploadUrl = await getPresignedUploadUrl(s3Key, "audio/mpeg");

  // Increment voice slots used (atomic via RPC)
  await adminClient.rpc("increment_voice_slots", { p_user_id: user.id });

  return NextResponse.json({
    voiceId: voice.id,
    uploadUrl,
    s3Key,
  });
}
