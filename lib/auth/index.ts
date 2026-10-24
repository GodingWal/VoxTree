import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";

import { authConfig } from "./config";
import { verifyPassword } from "./password";

/**
 * Full Auth.js (NextAuth v5) setup — replaces the former hosted auth (Phase 3).
 *
 * - Drizzle adapter persists users/accounts in the local Postgres.
 * - Credentials provider verifies email/password against
 *   `users.password_hash` (bcrypt, see lib/auth/password.ts).
 * - Google comes from authConfig and only exists when its env is set.
 * - JWT sessions: `session.user.id` is the app `users.id`, so server
 *   code resolves the current user without a sessions-table lookup.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .toLowerCase()
          .trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        // No row, or OAuth-only account (no password set): same
        // indistinguishable failure as a wrong password.
        if (!user?.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
});
