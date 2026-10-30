const ADMIN_EMAILS = ["gwal325@gmail.com"];

/**
 * Check whether a user (by email) is an admin.
 *
 * Allowlist only. There used to be a fallback query against a `role`
 * column on the `users` table, but that column does not exist in
 * lib/db/schema.ts (it was a Supabase-era add-on), so the fallback
 * always threw and returned false. Behavior is unchanged: allowlisted
 * emails are admins, everyone else is not.
 *
 * Kept async so existing callers (`await isAdmin(...)`) are untouched.
 */
export async function isAdmin(email: string | undefined | null): Promise<boolean> {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
