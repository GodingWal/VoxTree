"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateBedtimeSettings(formData: FormData) {
  const time = formData.get("time") as string;
  const autodim = formData.get("autodim") === "true";
  const audio = formData.get("audio") as string;

  if (!time) {
    return { success: false, error: "Please specify a bedtime." };
  }

  const supabase = createClient();

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated." };
  }

  // 2. Update user profile
  const { error } = await supabase
    .from("users")
    .update({
      bedtime_time: time,
      bedtime_autodim: autodim,
      default_background_audio: audio
    })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to update bedtime settings:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/family");
  revalidatePath("/dashboard/family/bedtime");
  revalidatePath("/dashboard", "layout");

  return { success: true };
}
