import type { DefaultSession } from "next-auth";

/**
 * Auth.js session augmentation: VoxTree sessions always carry the app
 * `users.id` (uuid) on `session.user.id` — set from the JWT `sub` claim
 * in lib/auth/config.ts. Phase 4 call sites should prefer
 * lib/auth/session.ts helpers over reading the session directly.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
