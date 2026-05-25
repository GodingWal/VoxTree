"use client";

import { useState } from "react";
import { KeyRound, Loader2, UserCog, CheckCircle2 } from "lucide-react";
import { resetUserPassword, updateUser } from "./actions";
import type { User, Plan } from "@/types/database";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--paper-mute)",
  marginBottom: 6,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: "var(--ink-0)",
  border: "1px solid var(--ink-3)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  color: "var(--paper)",
  outline: "none",
  transition: "border-color 0.2s",
};

interface UserActionsProps {
  user: User & { email: string };
}

export function UserActions({ user }: UserActionsProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState(user.name || "");
  const [plan, setPlan] = useState<Plan>(user.plan);
  const [voiceSlotsUsed, setVoiceSlotsUsed] = useState(user.voice_slots_used);
  const [videosUsed, setVideosUsed] = useState(user.videos_used);
  const [storiesUsed, setStoriesUsed] = useState(user.stories_used);
  const [stripeCustomerId, setStripeCustomerId] = useState(user.stripe_customer_id || "");

  async function handlePasswordReset() {
    if (!confirm(`Are you sure you want to send a password reset email to ${user.email}?`)) return;
    
    setIsResetting(true);
    const result = await resetUserPassword(user.email);
    setIsResetting(false);

    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    }
  }

  function handleResetCounters() {
    if (!confirm("Are you sure you want to reset all usage counters for this user? This will set voice slots, clips, and stories used back to 0.")) return;
    setVoiceSlotsUsed(0);
    setVideosUsed(0);
    setStoriesUsed(0);
  }

  async function handleManageSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await updateUser(user.id, {
      name: name || null,
      plan: plan,
      voice_slots_used: voiceSlotsUsed,
      videos_used: videosUsed,
      stories_used: storiesUsed,
      stripe_customer_id: stripeCustomerId || null,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      setIsManageOpen(false);
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
      <button
        onClick={() => {
          // Reset states to current user object values when opening
          setName(user.name || "");
          setPlan(user.plan);
          setVoiceSlotsUsed(user.voice_slots_used);
          setVideosUsed(user.videos_used);
          setStoriesUsed(user.stories_used);
          setStripeCustomerId(user.stripe_customer_id || "");
          setIsManageOpen(true);
        }}
        title="Manage User"
        style={{
          padding: 8,
          borderRadius: 8,
          border: "none",
          background: "transparent",
          color: "var(--paper-dim)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--ink-2)";
          e.currentTarget.style.color = "var(--lamp)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--paper-dim)";
        }}
      >
        <UserCog className="h-4 w-4" />
      </button>

      <button
        onClick={handlePasswordReset}
        disabled={isResetting || resetSuccess}
        title="Send Password Reset"
        style={{
          padding: 8,
          borderRadius: 8,
          border: "none",
          background: "transparent",
          color: "var(--rose)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(232,133,108,0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {isResetting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : resetSuccess ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
      </button>

      {isManageOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(10, 14, 31, 0.82)",
          backdropFilter: "blur(4px)",
          padding: 16,
        }}>
          <div style={{
            backgroundColor: "var(--ink-1)",
            border: "1px solid var(--ink-3)",
            borderRadius: 20,
            maxWidth: 440,
            width: "100%",
            padding: 28,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            maxHeight: "90vh",
            overflowY: "auto",
            textAlign: "left",
          }} className="fadeUp">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>
                  Manage <span className="serif-italic">User</span>
                </h3>
                <p style={{ fontSize: 12, color: "var(--paper-mute)", margin: "4px 0 0" }}>
                  {user.email}
                </p>
              </div>
              <button
                onClick={() => setIsManageOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--paper-dim)",
                  cursor: "pointer",
                  fontSize: 20,
                }}
              >
                ✕
              </button>
            </div>

            {error && (
              <div style={{
                marginBottom: 16,
                padding: 12,
                backgroundColor: "rgba(232,133,108,0.1)",
                border: "1px solid var(--rose)",
                color: "var(--rose)",
                borderRadius: 8,
                fontSize: 14,
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleManageSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="No Name"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Subscription Plan</label>
                <select
                  name="plan"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as Plan)}
                  style={inputStyle}
                >
                  <option value="free">Free Plan</option>
                  <option value="family">Family Plan</option>
                  <option value="premium">Premium Plan</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Stripe Customer ID</label>
                <input
                  name="stripe_customer_id"
                  value={stripeCustomerId}
                  onChange={(e) => setStripeCustomerId(e.target.value)}
                  placeholder="cus_..."
                  style={inputStyle}
                />
              </div>

              <div style={{
                border: "1px solid var(--ink-3)",
                borderRadius: 12,
                padding: 16,
                backgroundColor: "var(--ink-0)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="mono" style={{ fontSize: 10, letterSpacing: "0.05em", color: "var(--paper-mute)", textTransform: "uppercase" }}>
                    Usage Counters
                  </span>
                  <button
                    type="button"
                    onClick={handleResetCounters}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--rose)",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: 500,
                      padding: 0,
                    }}
                  >
                    Reset All to 0
                  </button>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, fontSize: 9 }}>Voice Slots</label>
                    <input
                      type="number"
                      value={voiceSlotsUsed}
                      onChange={(e) => setVoiceSlotsUsed(parseInt(e.target.value) || 0)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, fontSize: 9 }}>Clips Used</label>
                    <input
                      type="number"
                      value={videosUsed}
                      onChange={(e) => setVideosUsed(parseInt(e.target.value) || 0)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, fontSize: 9 }}>Stories Used</label>
                    <input
                      type="number"
                      value={storiesUsed}
                      onChange={(e) => setStoriesUsed(parseInt(e.target.value) || 0)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsManageOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "8px 16px",
                    color: "var(--paper-dim)",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: "var(--lamp)",
                    color: "var(--ink-0)",
                    border: "none",
                    borderRadius: 99,
                    padding: "8px 24px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Adjustments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
