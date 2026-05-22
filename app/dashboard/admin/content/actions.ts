"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ContentItem } from "@/types/database";

export async function addContent(data: Omit<ContentItem, "id" | "created_at">) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(user.email))) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("content_library")
    .insert([data]);

  if (error) {
    console.error("Error adding content:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/content");
  revalidatePath("/browse");
  return { success: true };
}

export async function deleteContent(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(user.email))) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("content_library")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting content:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/content");
  revalidatePath("/browse");
  return { success: true };
}
