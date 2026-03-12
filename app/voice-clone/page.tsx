import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS } from "@/lib/limits";
import { redirect } from "next/navigation";
import VoiceCloneClient from "./VoiceCloneClient";

export const metadata = {
  title: "Clone a Voice — VoxTree",
  description: "Upload or record a family member's voice to create a personalized narrator for children's stories.",
};

export default async function VoiceClonePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("plan, voice_slots_used")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan];
  const voiceSlotsUsed = profile?.voice_slots_used ?? 0;
  const atLimit =
    limits.voice_slots !== null && voiceSlotsUsed >= limits.voice_slots;

  return (
    <VoiceCloneClient
      userId={user.id}
      plan={plan}
      voiceSlotsUsed={voiceSlotsUsed}
      voiceSlotLimit={limits.voice_slots}
      atLimit={atLimit}
    />
  );
}
