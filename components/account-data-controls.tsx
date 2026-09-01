"use client";

import { useState } from "react";
import { Download, ShieldX, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function AccountDataControls({ email }: { email: string }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function revokeConsent() {
    if (!window.confirm("Revoke consent now? New voice and story generation will be blocked until you consent again.")) return;
    setBusy(true);
    const response = await fetch("/api/account/revoke-consent", { method: "POST" });
    setMessage(response.ok ? "Consent revoked. Existing data remains available for export or deletion." : "Consent could not be revoked.");
    setBusy(false);
  }

  async function deleteAccount() {
    setBusy(true);
    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation, email: emailConfirmation }),
    });
    const body = await response.json();
    if (response.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    setMessage(body.error ?? "Account deletion failed.");
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {message && <div role="status" style={{ padding: 14, borderRadius: 12, border: "1px solid var(--ink-3)", color: "var(--paper-dim)" }}>{message}</div>}
      <a href="/api/account/export" download style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--lamp-soft)", textDecoration: "none" }}>
        <Download size={18} aria-hidden="true" /> Download my family data
      </a>
      <button type="button" onClick={revokeConsent} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 10, padding: 0, border: 0, background: "transparent", color: "var(--lamp-soft)", cursor: "pointer", fontSize: 14 }}>
        <ShieldX size={18} aria-hidden="true" /> Revoke parental consent
      </button>
      <div style={{ borderTop: "1px solid var(--ink-3)", paddingTop: 20 }}>
        <p style={{ color: "var(--rose)", fontWeight: 700, margin: "0 0 8px" }}>Permanently delete account</p>
        <p style={{ color: "var(--paper-mute)", fontSize: 13, lineHeight: 1.5 }}>This deletes your account, database records, private voice and clip files, and ElevenLabs voices. It cannot be undone.</p>
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <input value={emailConfirmation} onChange={(event) => setEmailConfirmation(event.target.value)} placeholder={email} aria-label="Confirm account email" style={{ padding: 12, borderRadius: 10, border: "1px solid var(--ink-3)", background: "var(--ink-1)", color: "var(--paper)" }} />
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type DELETE" aria-label="Type DELETE to confirm" style={{ padding: 12, borderRadius: 10, border: "1px solid var(--ink-3)", background: "var(--ink-1)", color: "var(--paper)" }} />
          <button type="button" onClick={deleteAccount} disabled={busy || confirmation !== "DELETE" || emailConfirmation.toLowerCase() !== email.toLowerCase()} style={{ justifySelf: "start", display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", borderRadius: 10, border: "1px solid rgba(232,133,108,.35)", background: "rgba(232,133,108,.1)", color: "var(--rose)", cursor: "pointer", opacity: busy || confirmation !== "DELETE" ? 0.5 : 1 }}>
            <Trash2 size={16} aria-hidden="true" /> Delete account permanently
          </button>
        </div>
      </div>
    </div>
  );
}
