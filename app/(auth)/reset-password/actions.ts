"use server";

import { consumePasswordReset } from "@/lib/auth/password-reset";

export type ResetResult = { error: string } | { success: true };

/** Consumes a reset token and sets the new password hash. */
export async function resetPassword(input: {
  email: string;
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<ResetResult> {
  if (input.password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (input.password !== input.confirmPassword) {
    return { error: "Passwords do not match." };
  }
  const ok = await consumePasswordReset(input.email, input.token, input.password);
  if (!ok) {
    return {
      error: "This reset link is invalid or has expired. Request a new one and try again.",
    };
  }
  return { success: true };
}
