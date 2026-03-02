import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/**
 * Direct audio upload endpoint for voice cloning.
 * Stores audio in Supabase Storage when AWS S3 is not configured.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const voiceId = formData.get("voiceId") as string;
  const audio = formData.get("audio") as File;

  if (!voiceId || !audio) {
    return NextResponse.json({ error: "voiceId and audio are required" }, { status: 400 });
  }

  // Verify voice belongs to user
  const { data: voice } = await adminClient
    .from("family_voices")
    .select("id, user_id")
    .eq("id", voiceId)
    .eq("user_id", user.id)
    .single();

  if (!voice) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  // Upload to Supabase Storage
  const filePath = `voice-samples/${user.id}/${voiceId}/original.${audio.name.split(".").pop() || "mp3"}`;
  const buffer = Buffer.from(await audio.arrayBuffer());

  const { error: uploadError } = await adminClient.storage
    .from("voice-samples")
    .upload(filePath, buffer, {
      contentType: audio.type || "audio/mpeg",
      upsert: true,
    });

  if (uploadError) {
    // If bucket doesn't exist, try creating it
    if (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
      await adminClient.storage.createBucket("voice-samples", { public: false });
      const { error: retryError } = await adminClient.storage
        .from("voice-samples")
        .upload(filePath, buffer, {
          contentType: audio.type || "audio/mpeg",
          upsert: true,
        });
      if (retryError) {
        return NextResponse.json({ error: "Upload failed: " + retryError.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
    }
  }

  // Store the storage path in the voice record
  await adminClient
    .from("family_voices")
    .update({ sample_audio_url: filePath })
    .eq("id", voiceId);

  return NextResponse.json({ success: true, filePath });
}
