"use client";

import { useState } from "react";

export function BillingPortalButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function openPortal() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    const body = await response.json();
    if (response.ok && body.url) window.location.assign(body.url);
    else { setError(body.error ?? "Billing portal unavailable."); setBusy(false); }
  }
  return <div><button type="button" onClick={openPortal} disabled={busy} style={{ padding: "10px 18px", background: "transparent", color: "var(--lamp-soft)", border: "1px solid var(--ink-3)", borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{busy ? "Opening…" : "Manage or cancel"}</button>{error && <p role="alert" style={{ color: "var(--rose)", fontSize: 12 }}>{error}</p>}</div>;
}
