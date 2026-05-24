"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TwilightShell } from "@/components/twilight-layout";
import { Section } from "@/components/twilight-ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
  }

  return (
    <TwilightShell>
      <div style={{ maxWidth: 440, margin: "64px auto", padding: "0 24px" }}>
        <Section title="Sign in to your account">
          <form onSubmit={handleEmailLogin} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
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

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label htmlFor="password" className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "24px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--ink-3)" }} />
            <div className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", textTransform: "uppercase" }}>Or</div>
            <div style={{ flex: 1, height: 1, background: "var(--ink-3)" }} />
          </div>

          <button
            onClick={handleGoogleLogin}
            style={{
              width: "100%",
              background: "transparent", color: "var(--paper)",
              border: "1px solid var(--ink-3)", borderRadius: 12, padding: "12px 16px",
              fontSize: 15, fontWeight: 500, cursor: "pointer"
            }}
          >
            Continue with Google
          </button>

          <p style={{ textAlign: "center", marginTop: 32, fontSize: 14, color: "var(--paper-dim)" }}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" style={{ color: "var(--lamp)", textDecoration: "none" }}>
              Sign up
            </Link>
          </p>
        </Section>
      </div>
    </TwilightShell>
  );
}
