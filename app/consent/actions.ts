"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function verifyParentalConsent() {
  const supabase = createClient();

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be logged in to verify consent." };
  }

  // 2. Update user's profile
  const { error } = await supabase
    .from("users")
    .update({ consent_verified: true })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to verify parental consent:", error);
    return { success: false, error: error.message };
  }

  // 3. Clear cache
  revalidatePath("/consent");
  revalidatePath("/dashboard", "layout");

  return { success: true };
}
