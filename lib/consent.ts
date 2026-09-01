import { createAdminClient } from "./supabase/admin";

export async function hasActiveConsent(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("consent_verified")
    .eq("id", userId)
    .single();
  return !error && data?.consent_verified === true;
}
