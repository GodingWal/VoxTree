"use client";

import { useState } from "react";

type Role = "grandparent" | "parent" | "other";
type Status = "idle" | "submitting" | "success" | "duplicate" | "error";

const inputStyle: React.CSSProperties = {
  background: "var(--ink-1)",
  border: "1px solid var(--ink-3)",
  borderRadius: 12,
  padding: "12px 16px",
  color: "var(--paper)",
  outline: "none",
  fontSize: 15,
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--paper-mute)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

/**
 * Founding-family waitlist capture for the public /pilot page.
 * Submits to POST /api/waitlist; signup is free and is not a purchase.
 * `idPrefix` keeps element ids unique when the form appears twice on
 * one page (hero + closing section).
 */
export function WaitlistForm({ idPrefix = "waitlist" }: { idPrefix?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const nameId = `${idPrefix}-name`;
  const emailId = `${idPrefix}-email`;
  const roleId = `${idPrefix}-role`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError("Please enter your name.");
      setStatus("error");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      setStatus("error");
      return;
    }
    if (!role) {
      setError("Please tell us who would star in the videos.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail, role }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; duplicate?: boolean; message?: string; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus(data?.duplicate ? "duplicate" : "success");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        style={{
          padding: 28,
          borderRadius: 22,
          background: "var(--ink-2)",
          border: "1px solid rgba(127,196,164,0.35)",
          textAlign: "left",
        }}
      >
        <h3 className="serif" style={{ margin: 0, fontSize: 26, color: "var(--paper)" }}>
          You&apos;re on the list 🌳
        </h3>
        <p style={{ margin: "12px 0 0", color: "var(--paper-dim)", lineHeight: 1.65 }}>
          Thank you for joining the VoxTree founding-family waitlist. VoxTree isn&apos;t
          launched yet — we&apos;re building a small pilot for 20–50 families, starting with
          long-distance grandparents. When pilot spots open, waitlist families hear first,
          in order, with the full details — including final pilot pricing (planned at $99
          for the pilot year) — before anything is charged.
        </p>
        <p style={{ margin: "12px 0 0", color: "var(--paper-dim)", lineHeight: 1.65 }}>
          What happens next: you&apos;ll get one short email from us explaining what a
          participating grandparent needs to prepare (it&apos;s simple — a short voice
          recording and a few photos). When your pilot invitation is ready, we&apos;ll email
          you personally with the start date for your group and the consent steps, explained
          in plain language. If you join the pilot, we set up your family&apos;s account
          together, with help — especially for grandparents.
        </p>
      </div>
    );
  }

  if (status === "duplicate") {
    return (
      <div
        role="status"
        style={{
          padding: 28,
          borderRadius: 22,
          background: "var(--ink-2)",
          border: "1px solid rgba(127,196,164,0.35)",
          textAlign: "left",
        }}
      >
        <h3 className="serif" style={{ margin: 0, fontSize: 26, color: "var(--paper)" }}>
          You&apos;re already on the list 🌳
        </h3>
        <p style={{ margin: "12px 0 0", color: "var(--paper-dim)", lineHeight: 1.65 }}>
          Good news — this email is already on the VoxTree founding-family waitlist, so
          there&apos;s nothing more to do. When pilot spots open, waitlist families hear
          first, in order, with the full details — including final pilot pricing (planned
          at $99 for the pilot year) — before anything is charged. No payment today, and no
          sales calls.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 28,
        borderRadius: 22,
        background: "var(--ink-2)",
        border: "1px solid var(--ink-3)",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label htmlFor={nameId} className="mono" style={labelStyle}>
          Your name
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          autoComplete="name"
          style={inputStyle}
          placeholder="Your name"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label htmlFor={emailId} className="mono" style={labelStyle}>
          Email
        </label>
        <input
          id={emailId}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={inputStyle}
          placeholder="you@example.com"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label htmlFor={roleId} className="mono" style={labelStyle}>
          Who would star in the videos?
        </label>
        <select
          id={roleId}
          value={role}
          onChange={(e) => setRole(e.target.value as Role | "")}
          required
          style={{ ...inputStyle, appearance: "none" }}
        >
          <option value="" disabled>
            Choose one
          </option>
          <option value="grandparent">A grandparent</option>
          <option value="parent">A parent</option>
          <option value="other">Someone else (an aunt, uncle, or other adult)</option>
        </select>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            color: "var(--rose)",
            fontSize: 13,
            background: "rgba(255,100,100,0.1)",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        style={{
          padding: "15px 24px",
          borderRadius: 999,
          background: "var(--lamp)",
          color: "var(--ink-0)",
          border: "none",
          fontWeight: 700,
          fontSize: 15,
          cursor: status === "submitting" ? "not-allowed" : "pointer",
          opacity: status === "submitting" ? 0.7 : 1,
        }}
      >
        {status === "submitting" ? "Joining…" : "Join the founding-family waitlist"}
      </button>
      <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: "var(--paper-mute)" }}>
        No payment today. We&apos;re starting small, on purpose.
      </p>
    </form>
  );
}
