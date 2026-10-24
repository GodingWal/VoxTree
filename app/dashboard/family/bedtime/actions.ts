"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/session";

export async function updateBedtimeSettings(formData: FormData) {
  const time = formData.get("time") as string;
  const autodim = formData.get("autodim") === "true";
  const audio = formData.get("audio") as string;

  if (!time) {
    return { success: false, error: "Please specify a bedtime." };
  }

  // 1. Get authenticated user
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated." };
  }

  // 2. Update user profile (RLS: users row is self-only, id = uid)
  try {
    await db
      .update(users)
      .set({
        bedtimeTime: time,
        bedtimeAutodim: autodim,
        defaultBackgroundAudio: audio,
      })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error("Failed to update bedtime settings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update bedtime settings.",
    };
  }

  revalidatePath("/dashboard/family");
  revalidatePath("/dashboard/family/bedtime");
  revalidatePath("/dashboard", "layout");

  return { success: true };
}
