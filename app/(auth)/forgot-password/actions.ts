"use server";

import { requestPasswordReset } from "@/lib/auth/password-reset";

/**
 * Starts a password reset. Intentionally returns nothing about whether
 * the account exists — the page shows a generic confirmation either way.
 */
export async function requestReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  await requestPasswordReset(email);
}
