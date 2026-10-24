"use server";

import { isAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { revalidatePath } from "next/cache";
import type { Plan } from "@/types/database";

export async function resetUserPassword(email: string) {
  const user = await getCurrentUser();

  if (!user || !(await isAdmin(user.email))) {
    return { error: "Unauthorized" };
  }

  // Auth.js password reset (lib/auth/password-reset.ts): stores a reset
  // token and sends the reset email. It never reveals whether the email
  // exists, so success is always reported (previously the hosted auth
  // resetPasswordForEmail error could surface here).
  try {
    await requestPasswordReset(email);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to send password reset email.",
    };
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
  const user = await getCurrentUser();

  if (!user || !(await isAdmin(user.email))) {
    return { error: "Unauthorized" };
  }

  // Update the users table. Name/plan live only on this row under
  // Auth.js — the old hosted auth.users metadata mirror has no
  // equivalent and nothing reads it anymore.
  const updates: Partial<{
    name: string | null;
    plan: Plan;
    voiceSlotsUsed: number;
    videosUsed: number;
    storiesUsed: number;
    stripeCustomerId: string | null;
  }> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.plan !== undefined) updates.plan = data.plan;
  if (data.voice_slots_used !== undefined) updates.voiceSlotsUsed = data.voice_slots_used;
  if (data.videos_used !== undefined) updates.videosUsed = data.videos_used;
  if (data.stories_used !== undefined) updates.storiesUsed = data.stories_used;
  if (data.stripe_customer_id !== undefined) updates.stripeCustomerId = data.stripe_customer_id;

  try {
    await db.update(users).set(updates).where(eq(users.id, id));
  } catch (error) {
    console.error("Error updating user table:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update user.",
    };
  }

  // Clear Next.js cache for the entire dashboard layout and admin page
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/admin/users");

  return { success: true };
}
