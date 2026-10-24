import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

import { auth } from "./index";

export type AppUser = typeof users.$inferSelect;

/** Thrown by requireUser()/requireUserId() when nobody is signed in. */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Canonical server-side identity helpers (Phase 3 of the local-stack
 * migration). Phase 4 migrates every former hosted `auth.getUser()`
 * call site to these — do not read the Auth.js session directly
 * elsewhere.
 */

/** Current user's id from the JWT session — no DB query. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Current user's full `users` row, or null when signed out. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const id = await getCurrentUserId();
  if (!id) return null;
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

/** Like getCurrentUser(), but throws UnauthorizedError when signed out. */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Like getCurrentUserId(), but throws UnauthorizedError when signed out. */
export async function requireUserId(): Promise<string> {
  const id = await getCurrentUserId();
  if (!id) throw new UnauthorizedError();
  return id;
}
