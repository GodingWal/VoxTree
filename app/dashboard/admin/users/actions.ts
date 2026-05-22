"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export async function resetUserPassword(email: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(user.email))) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  
  // Generate a password reset link
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: email,
  });

  if (error) {
    console.error("Error generating reset link:", error);
    return { error: error.message };
  }

  // In a real app with an email service, we would use adminClient.auth.resetPasswordForEmail
  // For now, since we might not have SMTP fully configured, we'll log the generated link 
  // or return it to be copied by the admin. We'll just return success here.
  // Actually, resetPasswordForEmail is cleaner if email is set up:
  
  const { error: resetError } = await adminClient.auth.resetPasswordForEmail(email);
  if (resetError) {
     return { error: resetError.message };
  }

  return { success: true };
}
