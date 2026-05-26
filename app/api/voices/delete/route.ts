import { NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteVoice } from "@/lib/elevenlabs";
import { safeJson } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { z } from "zod";

const deleteSchema = z.object({
  voiceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const parsed = deleteSchema.safeParse(parsedJson.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { voiceId } = parsed.data;

  // Verify ownership
  const { data: voice } = await supabase
    .from("family_voices")
    .select("id, user_id, elevenlabs_voice_id")
    .eq("id", voiceId)
    .single();

  if (!voice || voice.user_id !== user.id) {
    return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  }

  const admin = createAdminClient();

  try {
    // Delete from ElevenLabs if it exists
    if (voice.elevenlabs_voice_id) {
      try {
        await deleteVoice(voice.elevenlabs_voice_id);
      } catch (elError) {
        logger.warn("elevenlabs_voice_delete_failed", {
          elevenlabsVoiceId: voice.elevenlabs_voice_id,
          voiceId,
          message: elError instanceof Error ? elError.message : "Unknown error",
        });
      }
    }

    // Delete related clips to prevent orphaned data
    await admin.from("generated_clips").delete().eq("voice_id", voiceId);

    // Delete the voice record
    await admin.from("family_voices").delete().eq("id", voiceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("voice_delete_failed", {
      voiceId,
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Failed to delete voice" }, { status: 500 });
  }
}
