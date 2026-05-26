"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyParentalConsent } from "./actions";
import { Loader2, ShieldAlert, Sparkles, PenTool } from "lucide-react";

interface ConsentFormClientProps {
  parentName: string;
}

export function ConsentFormClient({ parentName }: ConsentFormClientProps) {
  const router = useRouter();
  const [name, setName] = useState(parentName || "");
  const [agree, setAgree] = useState(false);
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agree) {
      setError("You must agree to the terms of the Parental Consent Agreement.");
      return;
    }
    if (signature.trim().toLowerCase() !== name.trim().toLowerCase()) {
      setError("Digital signature must match your typed Full Name exactly.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await verifyParentalConsent();
      if (res.success) {
        router.refresh();
      } else {
        setError(res.error || "Failed to submit verification.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: "var(--ink-2)", border: "1px solid var(--ink-3)",
      borderRadius: 24, padding: "36px 40px",
    }} className="fadeUp">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{
          background: "rgba(244,184,96,0.1)", borderRadius: 12, padding: 10, color: "var(--lamp)"
        }}>
          <PenTool size={22} />
        </div>
        <h2 className="serif" style={{ fontSize: 24, color: "var(--paper)", margin: 0 }}>
          Parental Consent Agreement
        </h2>
      </div>

      {/* Legal Text Panel */}
      <div style={{
        background: "var(--ink-1)", border: "1px solid var(--ink-3)",
        borderRadius: 16, padding: 24, maxHeight: 220, overflowY: "auto",
        fontSize: 13, lineHeight: 1.6, color: "var(--paper-dim)", marginBottom: 28,
        textAlign: "left"
      }}>
        <p style={{ marginTop: 0 }}>
          <strong>Parental Consent for Child Audio/Visual Processing</strong>
        </p>
        <p>
          By signing this agreement, you authorize VoxTree to capture, store, and process:
        </p>
        <ul style={{ paddingLeft: 16, margin: "8px 0" }}>
          <li>Audio recordings of family members (including minors) to train voice clones.</li>
          <li>Webcam snapshots and visual frames to create Pixar-style illustrative storytellers.</li>
          <li>Synthesized bedtime story playbacks containing voice and visual overlays.</li>
        </ul>
        <p>
          <strong>Security, Privacy and Your Rights:</strong>
          <br />
          All data generated through VoxTree is encrypted during transit and at rest. Snapshots and audio samples are kept strictly private inside your family tree and are never shared, sold, or used to train third-party public AI models. You retain absolute ownership and control, and can permanently delete child profiles or voice clones at any time.
        </p>
        <p style={{ marginBottom: 0 }}>
          I certify that I am the parent or legal guardian of the child/children registered under this family account, and I have the authority to grant this consent.
        </p>
      </div>

      {error && (
        <div style={{
          background: "rgba(232,133,108,0.08)", border: "1px solid rgba(232,133,108,0.25)",
          borderRadius: 12, padding: 12, color: "var(--rose)", fontSize: 13,
          display: "flex", alignItems: "center", gap: 8, marginBottom: 20
        }}>
          <ShieldAlert size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Signing Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* Full Name */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          <label className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Parent/Guardian Full Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%", background: "var(--ink-1)", border: "1px solid var(--ink-3)",
              borderRadius: 12, padding: "14px 16px", color: "var(--paper)", fontSize: 15, outline: "none"
            }}
          />
        </div>

        {/* Legal checkbox */}
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", userSelect: "none" }}>
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            style={{ marginTop: 3, cursor: "pointer" }}
          />
          <span style={{ fontSize: 13, color: "var(--paper-dim)", lineHeight: 1.4 }}>
            I agree to the terms of the Parental Consent Agreement and confirm that I am the legal parent or guardian.
          </span>
        </label>

        {/* Digital Signature */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 12 }}>
          <label className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Digital Signature (Type your Full Name to sign)
          </label>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              required
              placeholder="e.g. Grandma Rose"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              style={{
                width: "100%", background: "var(--ink-1)", border: "1px solid var(--ink-3)",
                borderRadius: 12, padding: "14px 16px", color: "var(--paper)", fontSize: 15, outline: "none"
              }}
            />
            {/* Cursive overlay signature display */}
            {signature && (
              <div style={{
                position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                fontFamily: "'Brush Script MT', cursive, sans-serif", fontSize: 24, color: "var(--lamp-soft)",
                opacity: 0.8, pointerEvents: "none"
              }}>
                {signature}
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "16px", background: "var(--lamp)", color: "var(--ink-0)",
              border: "none", borderRadius: 99, fontWeight: 600, fontSize: 14,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 12px 30px -8px rgba(244,184,96,0.3)"
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing Agreement...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Authorize & Agree
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
