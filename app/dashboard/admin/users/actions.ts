"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Plan } from "@/types/database";

export async function resetUserPassword(email: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(user.email))) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  
  // Send a password reset email using auth.admin
  const { error: resetError } = await adminClient.auth.resetPasswordForEmail(email);
  if (resetError) {
     return { error: resetError.message };
  }

  return { success: true };
}

export async function updateUser(
  id: string,
  data: {
    name?: string | null;
    plan?: Plan;
    voice_slots_used?: number;
    videos_used?: number;
    stories_used?: number;
    stripe_customer_id?: string | null;
  }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(user.email))) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("users")
    .update(data)
    .eq("id", id);

  if (error) {
    console.error("Error updating user:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}
