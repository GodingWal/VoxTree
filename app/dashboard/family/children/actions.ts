"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

  const supabase = createClient();

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated." };
  }

  // 2. Insert child
  const { error } = await supabase
    .from("family_children")
    .insert({
      user_id: user.id,
      name: name.trim(),
      age: age
    });

  if (error) {
    console.error("Failed to add child to DB:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/family");
  revalidatePath("/dashboard/family/children");
  return { success: true };
}

export async function deleteChild(childId: string) {
  if (!childId) {
    return { success: false, error: "Invalid child ID." };
  }

  const supabase = createClient();

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated." };
  }

  // 2. Delete child
  const { error } = await supabase
    .from("family_children")
    .delete()
    .eq("id", childId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to delete child from DB:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/family");
  revalidatePath("/dashboard/family/children");
  return { success: true };
}
