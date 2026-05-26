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

  // 1. Update the public.users database table
  const { error } = await adminClient
    .from("users")
    .update(data)
    .eq("id", id);

  if (error) {
    console.error("Error updating user table:", error);
    return { error: error.message };
  }

  // 2. Synchronize user metadata and app metadata with auth.users
  try {
    const authUpdates: any = {};
    if (data.name !== undefined) {
      authUpdates.user_metadata = { full_name: data.name };
    }
    if (data.plan !== undefined) {
      authUpdates.app_metadata = { plan: data.plan };
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(id, authUpdates);
      if (authError) {
        console.warn("Failed to synchronize auth user metadata:", authError.message);
      }
    }
  } catch (err) {
    console.error("Auth metadata sync exception:", err);
  }

  // 3. Clear Next.js cache for the entire dashboard layout and admin page
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/admin/users");
  
  return { success: true };
}
