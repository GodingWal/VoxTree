"use client";

import { useState } from "react";
import Link from "next/link";
import { TwilightShell } from "@/components/twilight-layout";
import { Section } from "@/components/twilight-ui";

import { requestReset } from "./actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData();
    formData.set("email", email);
    await requestReset(formData);
    setSent(true);
    setLoading(false);
  }

  return (
    <TwilightShell>
      <div style={{ maxWidth: 440, margin: "64px auto", padding: "0 24px" }}>
        <Section title="Reset your password">
          {sent ? (
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ color: "var(--paper)", fontSize: 13, background: "rgba(127,196,164,0.15)", border: "1px solid rgba(127,196,164,0.3)", padding: 16, borderRadius: 10, lineHeight: 1.5 }}>
                If an account exists for {email}, a password reset link is on its way. The link expires in one hour.
              </div>
              <p style={{ textAlign: "center", fontSize: 14, color: "var(--paper-dim)" }}>
                <Link href="/login" style={{ color: "var(--lamp)", textDecoration: "none" }}>
                  Back to sign in
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
              <p style={{ fontSize: 14, color: "var(--paper-dim)", lineHeight: 1.5 }}>
                Enter the email address for your account and we&apos;ll send you a link to reset your password.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label htmlFor="email" className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    background: "var(--ink-1)", border: "1px solid var(--ink-3)",
                    borderRadius: 12, padding: "12px 16px", color: "var(--paper)",
                    outline: "none", fontSize: 15
                  }}
                  placeholder="you@example.com"
                />
              </div>

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
                {loading ? "Sending..." : "Send reset link"}
              </button>

              <p style={{ textAlign: "center", fontSize: 14, color: "var(--paper-dim)" }}>
                Remembered it?{" "}
                <Link href="/login" style={{ color: "var(--lamp)", textDecoration: "none" }}>
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </Section>
      </div>
    </TwilightShell>
  );
}
