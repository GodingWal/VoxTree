import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge/proxy-safe Auth.js config (no DB, no bcrypt) — imported by
 * proxy.ts for session checks. The full config in lib/auth/index.ts
 * spreads this and adds the Drizzle adapter + Credentials provider.
 *
 * Google OAuth is enabled only when AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
 * are set; otherwise the provider is omitted entirely and the login
 * page hides the Google button (see `googleEnabled`).
 */
export const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: googleEnabled ? [Google] : [],
  callbacks: {
    jwt({ token, user }) {
      // `user` is present only at sign-in; persist the app user id as
      // the JWT subject so session reads stay DB-free.
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
