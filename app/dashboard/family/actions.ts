"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { familyInvitations, users } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

/**
 * Result shape for the invite callers. `simulated`/`message` are kept
 * as optional fields for compatibility with invite-button.tsx, which
 * reads them — but they are never set anymore: a failed insert is an
 * honest error now, not a fake "simulated" success (that fallback was
 * Supabase-era copy; in the local stack the table either exists or the
 * invitation genuinely was not saved).
 */
export type InviteFamilyMemberResult =
  | { success: false; error: string }
  | { success: true; email: string; simulated?: boolean; message?: string };

export async function inviteFamilyMember(formData: FormData): Promise<InviteFamilyMemberResult> {
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
    // Honest failure: the invitation was not persisted, so do not
    // report success — in simulation mode or otherwise.
    logger.error("family_invitation_insert_failed", {
      error:
        inviteError instanceof Error ? inviteError.message : String(inviteError),
    });
    return { success: false, error: "Invitation could not be saved." };
  }

  logger.info("family_invitation_email_sent");

  revalidatePath("/dashboard/family");
  return { success: true, email };
}
