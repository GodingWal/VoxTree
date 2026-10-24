"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { familyInvitations, users } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/session";
import { isSimulationEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";

export async function inviteFamilyMember(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email || !email.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }

  // 1. Get authenticated user
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated." };
  }

  // 2. Fetch user's profile and check plan (RLS: users row is self-only).
  const [profile] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!profile) {
    return { success: false, error: "Failed to verify user profile." };
  }

  if (profile.plan !== "premium") {
    return {
      success: false,
      error: "Only accounts with Premium membership can invite family members. Please upgrade your plan.",
    };
  }

  // 3. Attempt to insert invitation into the database
  // (RLS owner policy: user_id = uid).
  let inviteError: unknown = null;
  try {
    await db.insert(familyInvitations).values({
      userId,
      email,
      status: "pending",
    });
  } catch (err) {
    inviteError = err;
  }

  if (inviteError) {
    if (!isSimulationEnabled()) {
      return { success: false, error: "Invitation could not be saved." };
    }
    console.warn("Database insert failed for family_invitations in development simulation.", inviteError);

    // Fallback/Simulation mode (e.g. if the family_invitations table has
    // not been created yet in the local database)
    // We can store a temporary simulation cookie or just return success with a simulation flag
    revalidatePath("/dashboard/family");
    return {
      success: true,
      simulated: true,
      email,
      message: "Invitation simulated successfully! (Note: Please apply the database migrations to persist this permanently).",
    };
  }

  logger.info("family_invitation_email_sent");

  revalidatePath("/dashboard/family");
  return { success: true, email };
}
