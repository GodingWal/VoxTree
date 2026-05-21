import { createAdminClient } from "./supabase/admin";

const ADMIN_EMAILS = ["gwal325@gmail.com"];

/**
 * Check whether a user (by email) is an admin.
 * First checks the hardcoded allow-list, then falls back to
 * a `role` column on the `users` table if it exists.
 */
export async function isAdmin(email: string | undefined | null): Promise<boolean> {
  if (!email) return false;
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return true;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("email", email.toLowerCase())
      .single();
    return data?.role === "admin";
  } catch {
    // If the column doesn't exist yet, fall back to false
    return false;
  }
}

/**
 * Lightweight check for the client — just checks the hardcoded list.
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
