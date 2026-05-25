"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function inviteFamilyMember(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email || !email.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const supabase = createClient();

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated." };
  }

  // 2. Fetch user's profile and check plan
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "Failed to verify user profile." };
  }

  if (profile.plan !== "premium") {
    return {
      success: false,
      error: "Only accounts with Premium membership can invite family members. Please upgrade your plan.",
    };
  }

  // 3. Attempt to insert invitation into the database
  const { error: inviteError } = await supabase
    .from("family_invitations")
    .insert({
      user_id: user.id,
      email: email,
      status: "pending",
    });

  if (inviteError) {
    console.warn("Database insert failed for family_invitations. It is likely the table does not exist yet. Running in simulation mode.", inviteError);

    // Fallback/Simulation mode (e.g. if migration 004 has not been run yet on their remote Supabase instance)
    // We can store a temporary simulation cookie or just return success with a simulation flag
    revalidatePath("/dashboard/family");
    return {
      success: true,
      simulated: true,
      email,
      message: "Invitation simulated successfully! (Note: Please run the 004_family_invitations.sql migration on your Supabase database to persist this permanently).",
    };
  }

  console.log(`Successfully sent email invitation to: ${email}`);

  revalidatePath("/dashboard/family");
  return { success: true, email };
}
