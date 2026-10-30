import { describe, it, expect, vi, afterEach } from "vitest";

import { authConfig, googleEnabled } from "@/lib/auth/config";

/**
 * Tests for the Auth.js callbacks in lib/auth/config.ts (the edge-safe
 * config spread into the full setup in lib/auth/index.ts).
 *
 * Real semantics pinned here (read from the implementation):
 * - There are exactly two callbacks: `jwt` and `session`. There is NO
 *   `signIn` callback and NO `authorized` callback in this config, so
 *   this config itself neither allows nor denies any sign-in and does
 *   no consent/attestation gating — those decisions live elsewhere
 *   (Credentials authorize() in lib/auth/index.ts, consent checks in
 *   the API routes). These tests pin that absence so a future silent
 *   change is visible.
 * - jwt: `user` is present only at sign-in; when user.id exists it is
 *   persisted as token.sub. Otherwise the token passes through as-is.
 * - session: when token.sub exists it is copied to session.user.id;
 *   otherwise the session passes through untouched.
 * - pages.signIn is "/login"; the Google provider exists only when
 *   both AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set.
 */

type JwtFn = (args: { token: Record<string, unknown>; user?: { id?: string } | null }) => Record<string, unknown>;
type SessionFn = (args: {
  session: { user: Record<string, unknown>; expires: string };
  token: Record<string, unknown>;
}) => { user: Record<string, unknown>; expires: string };

const jwt = authConfig.callbacks!.jwt as unknown as JwtFn;
const sessionCb = authConfig.callbacks!.session as unknown as SessionFn;

describe("authConfig shape", () => {
  it("points the sign-in page at /login", () => {
    expect(authConfig.pages?.signIn).toBe("/login");
  });

  it("defines exactly the jwt and session callbacks — no signIn/authorized gate in this config", () => {
    const callbacks = authConfig.callbacks as unknown as Record<string, unknown>;
    expect(Object.keys(callbacks).sort()).toEqual(["jwt", "session"]);
    expect(callbacks.signIn).toBeUndefined();
    expect(callbacks.authorized).toBeUndefined();
  });
});

describe("jwt callback", () => {
  it("persists the signing-in user's id as token.sub", () => {
    const token = jwt({ token: { sub: undefined }, user: { id: "user-123" } });
    expect(token.sub).toBe("user-123");
  });

  it("overwrites a stale sub with the new sign-in user's id", () => {
    const token = jwt({ token: { sub: "old-user" }, user: { id: "new-user" } });
    expect(token.sub).toBe("new-user");
  });

  it("leaves the token untouched on later requests (no user present)", () => {
    const input = { sub: "user-123", iat: 42 };
    const token = jwt({ token: { ...input } });
    expect(token).toEqual(input);
  });

  it("does not clear an existing sub when the user object has no id", () => {
    const token = jwt({ token: { sub: "user-123" }, user: {} });
    expect(token.sub).toBe("user-123");
  });

  it("does not invent a sub for an anonymous token", () => {
    const token = jwt({ token: {}, user: null });
    expect(token.sub).toBeUndefined();
  });
});

describe("session callback", () => {
  it("exposes the user id on session.user.id from token.sub", () => {
    const session = sessionCb({
      session: { user: { name: "Test" }, expires: "2099-01-01" },
      token: { sub: "user-123" },
    });
    expect(session.user.id).toBe("user-123");
    expect(session.user.name).toBe("Test");
  });

  it("leaves the session alone when the token has no sub", () => {
    const input = { user: { name: "Test" } as Record<string, unknown>, expires: "2099-01-01" };
    const session = sessionCb({ session: input, token: {} });
    expect(session.user.id).toBeUndefined();
    expect(session).toBe(input);
  });

  it("round-trips: a sign-in jwt sub becomes the session user id", () => {
    const token = jwt({ token: {}, user: { id: "user-xyz" } });
    const session = sessionCb({
      session: { user: {}, expires: "2099-01-01" },
      token,
    });
    expect(session.user.id).toBe("user-xyz");
  });
});

describe("Google provider gating (googleEnabled)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is disabled and exposes no providers when the Google env vars are absent", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "");
    vi.resetModules();
    const fresh = await import("@/lib/auth/config");
    expect(fresh.googleEnabled).toBe(false);
    expect(fresh.authConfig.providers).toEqual([]);
  });

  it("is enabled with exactly one provider when both Google env vars are set", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "google-client-id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "google-client-secret");
    vi.resetModules();
    const fresh = await import("@/lib/auth/config");
    expect(fresh.googleEnabled).toBe(true);
    expect(fresh.authConfig.providers).toHaveLength(1);
  });

  it("stays disabled when only one of the two Google env vars is set", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "google-client-id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "");
    vi.resetModules();
    const fresh = await import("@/lib/auth/config");
    expect(fresh.googleEnabled).toBe(false);
    expect(fresh.authConfig.providers).toEqual([]);
  });

  it("the statically imported module matches the current environment", () => {
    // In the test environment the Google vars are unset.
    expect(googleEnabled).toBe(
      Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    );
  });
});
