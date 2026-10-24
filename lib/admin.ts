import { sql } from "drizzle-orm";

import { db } from "./db";

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
    // The local schema has no `role` column (it was an optional pre-migration
    // add-on); the query throws in that case and we fall back to false,
    // exactly as the PostgREST version did when the column was absent.
    const result = await db.execute(
      sql`select role from users where email = ${email.toLowerCase()} limit 1`
    );
    const row = result.rows[0] as { role?: string } | undefined;
    return row?.role === "admin";
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
