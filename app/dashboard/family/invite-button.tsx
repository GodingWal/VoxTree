"use client";

import React, { useState } from "react";
import { inviteFamilyMember } from "./actions";
import { Loader2, Mail, ShieldAlert, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

interface InviteMemberButtonProps {
  isPremium: boolean;
}

export function InviteMemberButton({ isPremium }: InviteMemberButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setWarning(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await inviteFamilyMember(formData);
      if (res.success) {
        setSuccess(`Invitation sent successfully to ${res.email}!`);
        if (res.simulated) {
          setWarning(res.message || "Running in simulation mode.");
        }
      } else {
        setError(res.error || "An error occurred. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit invitation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Invite Button */}
      <button
        onClick={() => {
          setIsOpen(true);
          setError(null);
          setSuccess(null);
          setWarning(null);
        }}
        style={{
          padding: "14px 22px",
          background: isPremium ? "var(--lamp)" : "rgba(244, 236, 219, 0.08)",
          color: isPremium ? "var(--ink-0)" : "var(--paper-dim)",
          border: isPremium ? "none" : "1px solid var(--ink-3)",
          borderRadius: 99,
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "all 0.2s ease",
        }}
        className="hover:opacity-90 active:scale-95"
      >
        {!isPremium && <Sparkles size={14} style={{ color: "var(--lamp-soft)" }} />}
        Invite member
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(10, 14, 31, 0.8)",
            backdropFilter: "blur(12px)",
          }}
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Container */}
          <div
            style={{
              background: "var(--ink-2)",
              border: "1px solid var(--ink-3)",
              borderRadius: 24,
              padding: "40px 32px",
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
              position: "relative",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
            className="fadeUp"
          >
            {/* Background Glow */}
            <div
              style={{
                position: "absolute",
                top: -100,
                right: -100,
                width: 250,
                height: 250,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(244, 184, 96, 0.15) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            {isPremium ? (
              /* PREMIUM USER: Send Invitation Form */
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div
                    style={{
                      background: "rgba(244, 184, 96, 0.1)",
                      borderRadius: 12,
                      padding: 10,
                      color: "var(--lamp)",
                    }}
                  >
                    <Mail size={24} />
                  </div>
                  <h3 className="serif" style={{ fontSize: 28, color: "var(--paper)", margin: 0 }}>
                    Invite to Family
                  </h3>
                </div>

                <p style={{ color: "var(--paper-dim)", fontSize: 14, lineHeight: 1.5, marginBottom: 28 }}>
                  Send an email invitation. Once accepted, they will be able to share voice clones, record new ones, and enjoy Bedtime together.
                </p>

                {success ? (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <CheckCircle2 size={48} style={{ color: "var(--moss)", marginBottom: 16 }} />
                    <div style={{ color: "var(--paper)", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
                      {success}
                    </div>
                    {warning && (
                      <div
                        style={{
                          background: "rgba(244, 184, 96, 0.08)",
                          border: "1px solid rgba(244, 184, 96, 0.2)",
                          borderRadius: 12,
                          padding: 12,
                          color: "var(--lamp-soft)",
                          fontSize: 12,
                          textAlign: "left",
                          marginTop: 12,
                          lineHeight: 1.4,
                          display: "flex",
                          gap: 8,
                        }}
                      >
                        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>{warning}</span>
                      </div>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      style={{
                        marginTop: 24,
                        padding: "12px 24px",
                        background: "var(--ink-3)",
                        color: "var(--paper)",
                        border: "none",
                        borderRadius: 99,
                        cursor: "pointer",
                        fontWeight: 600,
                        width: "100%",
                      }}
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 24 }}>
                      <label
                        className="mono"
                        style={{
                          display: "block",
                          fontSize: 10,
                          color: "var(--paper-mute)",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        Email Address
                      </label>
                      <input
                        type="email"
                        name="email"
                        required
                        placeholder="grandma@family.com"
                        style={{
                          width: "100%",
                          background: "var(--ink-1)",
                          border: "1px solid var(--ink-3)",
                          borderRadius: 12,
                          padding: "14px 16px",
                          color: "var(--paper)",
                          fontSize: 15,
                          outline: "none",
                        }}
                        className="focus:border-lamp/50 transition-colors"
                      />
                    </div>

                    {error && (
                      <div
                        style={{
                          color: "var(--rose)",
                          fontSize: 13,
                          marginBottom: 20,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <ShieldAlert size={16} />
                        {error}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        style={{
                          flex: 1,
                          padding: "14px",
                          background: "transparent",
                          color: "var(--paper-dim)",
                          border: "1px solid var(--ink-3)",
                          borderRadius: 99,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        style={{
                          flex: 1,
                          padding: "14px",
                          background: "var(--lamp)",
                          color: "var(--ink-0)",
                          border: "none",
                          borderRadius: 99,
                          cursor: "pointer",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        {loading ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Send Invitation"
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* NON-PREMIUM USER: Upgrade Prompt */
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: "rgba(244, 184, 96, 0.1)",
                    color: "var(--lamp)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                  }}
                >
                  <Sparkles size={28} />
                </div>

                <h3 className="serif" style={{ fontSize: 28, color: "var(--paper)", margin: "0 0 8px 0" }}>
                  Unlock Premium
                </h3>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--lamp-soft)",
                    marginBottom: 16,
                  }}
                >
                  Family Invitation Feature
                </div>

                <p style={{ color: "var(--paper-dim)", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
                  Collaborating on your Voice Tree and sending invites to family members is exclusive to the **Premium Plan**.
                </p>

                <div
                  style={{
                    background: "var(--ink-1)",
                    border: "1px solid var(--ink-3)",
                    borderRadius: 16,
                    padding: 16,
                    textAlign: "left",
                    marginBottom: 28,
                  }}
                >
                  <div style={{ fontSize: 13, color: "var(--paper)", fontWeight: 600, marginBottom: 12 }}>
                    Premium benefits:
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 20,
                      fontSize: 13,
                      color: "var(--paper-dim)",
                      lineHeight: 1.8,
                    }}
                  >
                    <li>Invite unlimited family members via email</li>
                    <li>Collaborate on shared story voiceovers</li>
                    <li>Unlimited voice clone slots</li>
                    <li>Priority audio generation & custom voice tuning</li>
                  </ul>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <a
                    href="/dashboard/settings"
                    style={{
                      padding: "14px",
                      background: "var(--lamp)",
                      color: "var(--ink-0)",
                      borderRadius: 99,
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: 14,
                      display: "block",
                    }}
                  >
                    Upgrade Plan Now
                  </a>
                  <button
                    onClick={() => setIsOpen(false)}
                    style={{
                      padding: "14px",
                      background: "transparent",
                      color: "var(--paper-dim)",
                      border: "1px solid var(--ink-3)",
                      borderRadius: 99,
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
