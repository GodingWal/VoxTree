import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { deleteVoice as deleteElevenLabsVoice } from "@/lib/elevenlabs";
import { NextResponse } from "next/server";

interface RouteContext {
  params: { id: string };
}

export async function GET(request: Request, { params }: RouteContext) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: voice, error } = await supabase
    .from("family_voices")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error || !voice) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  return NextResponse.json({ voice });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get voice to check ownership and get ElevenLabs ID
  const { data: voice } = await supabase
    .from("family_voices")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!voice) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  // Delete from ElevenLabs if it has an ID. If it fails, abort to prevent orphaned voices.
  if (voice.elevenlabs_voice_id) {
    try {
      await deleteElevenLabsVoice(voice.elevenlabs_voice_id);
    } catch (error) {
      console.error("Failed to delete voice from ElevenLabs:", error);
      return NextResponse.json(
        { error: "Failed to delete voice from ElevenLabs. Please try again." },
        { status: 500 }
      );
    }
  }

  // Delete from database
  const { error } = await supabase
    .from("family_voices")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete voice" }, { status: 500 });
  }

  // Decrement voice slots
  await adminClient.rpc("decrement_voice_slots", { p_user_id: user.id });

  return NextResponse.json({ success: true });
}
