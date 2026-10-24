"use client";

import { useState } from "react";
import Link from "next/link";
import { TwilightShell } from "@/components/twilight-layout";
import { Section } from "@/components/twilight-ui";

import { resetPassword } from "./actions";

export function ResetPasswordForm({ email, token }: { email: string; token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await resetPassword({ email, token, password, confirmPassword });
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
    } else {
      setDone(true);
      setLoading(false);
    }
  }

  const linkMissing = !token || !email;

  return (
    <TwilightShell>
      <div style={{ maxWidth: 440, margin: "64px auto", padding: "0 24px" }}>
        <Section title="Choose a new password">
          {done ? (
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ color: "var(--paper)", fontSize: 13, background: "rgba(127,196,164,0.15)", border: "1px solid rgba(127,196,164,0.3)", padding: 16, borderRadius: 10, lineHeight: 1.5 }}>
                Your password has been updated. Sign in with your new password to continue.
              </div>
              <p style={{ textAlign: "center", fontSize: 14, color: "var(--paper-dim)" }}>
                <Link href="/login" style={{ color: "var(--lamp)", textDecoration: "none" }}>
                  Sign in
                </Link>
              </p>
            </div>
          ) : linkMissing ? (
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ color: "var(--rose)", fontSize: 13, background: "rgba(255,100,100,0.1)", padding: 12, borderRadius: 8 }}>
                This reset link is incomplete. Request a new one and try again.
              </p>
              <p style={{ textAlign: "center", fontSize: 14, color: "var(--paper-dim)" }}>
                <Link href="/forgot-password" style={{ color: "var(--lamp)", textDecoration: "none" }}>
                  Request a new link
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label htmlFor="password" className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{
                    background: "var(--ink-1)", border: "1px solid var(--ink-3)",
                    borderRadius: 12, padding: "12px 16px", color: "var(--paper)",
                    outline: "none", fontSize: 15
                  }}
                  placeholder="••••••••"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label htmlFor="confirmPassword" className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{
                    background: "var(--ink-1)", border: "1px solid var(--ink-3)",
                    borderRadius: 12, padding: "12px 16px", color: "var(--paper)",
                    outline: "none", fontSize: 15
                  }}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p style={{ color: "var(--rose)", fontSize: 13, background: "rgba(255,100,100,0.1)", padding: 12, borderRadius: 8 }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: "var(--lamp)", color: "var(--ink-0)",
                  border: "none", borderRadius: 12, padding: "12px 16px",
                  fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1, marginTop: 8
                }}
              >
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>
          )}
        </Section>
      </div>
    </TwilightShell>
  );
}
