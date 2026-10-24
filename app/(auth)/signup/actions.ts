"use server";

import { eq } from "drizzle-orm";

import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type RegisterResult = { error: string } | { success: true };

/**
 * Creates the app `users` row with a bcrypt password hash (Phase 3 —
 * replaces the former hosted `auth.signUp`; there is no email-confirmation step
 * in the local stack, so the page signs the user in immediately after).
 */
export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  const name = input.name.trim();
  const email = input.email.toLowerCase().trim();
  const { password } = input;

  if (!name) return { error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return {
      error: "An account with this email already exists. Try signing in instead.",
    };
  }

  const passwordHash = await hashPassword(password);
  try {
    await db.insert(users).values({ name, email, passwordHash });
  } catch {
    // Includes the unique-email race with the check above.
    return { error: "Could not create your account. Please try again." };
  }
  return { success: true };
}
