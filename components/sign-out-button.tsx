"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

/**
 * Sign-out control for server-rendered pages (e.g. settings). Mirrors the
 * profile dropdown: Auth.js signOut() + client redirect to /login. The
 * old form POST to /auth/signout has no route under Auth.js.
 */
export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      style={{
        background: "none",
        border: 0,
        padding: 0,
        color: "var(--rose)",
        fontSize: 14,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}
