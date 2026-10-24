"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { familyChildren } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/session";

export async function addChild(formData: FormData) {
  const name = formData.get("name") as string;
  const ageStr = formData.get("age") as string;

  if (!name || !name.trim()) {
    return { success: false, error: "Please enter a name." };
  }

  const age = parseInt(ageStr);
  if (isNaN(age) || age < 0 || age > 18) {
    return { success: false, error: "Please enter a valid age between 0 and 18." };
  }

  // 1. Get authenticated user
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated." };
  }

  // 2. Insert child (RLS owner policy: user_id = uid)
  try {
    await db.insert(familyChildren).values({
      userId,
      name: name.trim(),
      age,
    });
  } catch (error) {
    console.error("Failed to add child to DB:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add child.",
    };
  }

  revalidatePath("/dashboard/family");
  revalidatePath("/dashboard/family/children");
  return { success: true };
}

export async function deleteChild(childId: string) {
  if (!childId) {
    return { success: false, error: "Invalid child ID." };
  }

  // 1. Get authenticated user
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated." };
  }

  // 2. Delete child (RLS owner policy: id + user_id = uid)
  try {
    await db
      .delete(familyChildren)
      .where(and(eq(familyChildren.id, childId), eq(familyChildren.userId, userId)));
  } catch (error) {
    console.error("Failed to delete child from DB:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete child.",
    };
  }

  revalidatePath("/dashboard/family");
  revalidatePath("/dashboard/family/children");
  return { success: true };
}
