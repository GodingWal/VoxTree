"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { TwilightShell } from "@/components/twilight-layout";

type BillingPeriod = "monthly" | "annual";

const plans = [
  {
    name: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    period: "forever",
    features: [
      "1 voice & visual profile",
      "2 story clips",
      "4 stories",
      "No time expiration",
    ],
    cta: "Get Started",
    href: "/signup",
    highlighted: false,
    plan: null,
  },
  {
    name: "Family",
    monthlyPrice: "$12.99",
    annualPrice: "$99",
    annualMonthly: "$8.25",
    period: "/month",
    features: [
      "2 family clones",
      "Full story content library",
      "Unlimited video generations",
    ],
    cta: "Upgrade to Family",
    plan: "family" as const,
    highlighted: true,
  },
  {
    name: "Premium",
    monthlyPrice: "$22.99",
    annualPrice: "$179",
    annualMonthly: "$14.92",
    period: "/month",
    features: [
      "Unlimited family clones",
      "Full story content library",
      "Unlimited video generations",
      "Priority AI processing queue",
      "Early access to new features",
      "Offline story downloads",
    ],
    cta: "Upgrade to Premium",
    plan: "premium" as const,
    highlighted: false,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(plan: "family" | "premium") {
    setLoading(plan);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (data.url) {
        window.location.href = data.url;
      } else {
        setError("An unexpected error occurred.");
      }
    } catch (e) {
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <TwilightShell>
      <div style={{ maxWidth: 1040, margin: "64px auto 80px", padding: "0 24px" }}>
        
        {/* Main header block */}
        <div style={{ textAlign: "center", marginBottom: 56 }} className="fadeUp">
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
            Plans & Pricing
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(36px, 5vw, 56px)", margin: "0 0 16px 0", color: "var(--paper)", letterSpacing: "-0.02em" }}>
            Simple, Transparent Pricing
          </h1>
          <p style={{ color: "var(--paper-dim)", fontSize: 15, maxWidth: 540, margin: "0 auto", lineHeight: 1.5 }}>
            Start free and upgrade as your family grows. Every plan includes our core voice & visual cloning technology.
          </p>
        </div>

        {error && (
          <div style={{
            background: "rgba(232, 133, 108, 0.08)",
            border: "1px solid rgba(232, 133, 108, 0.3)",
            borderRadius: 16,
            padding: 16,
            color: "var(--rose)",
            fontSize: 13,
            textAlign: "center",
            maxWidth: 480,
            margin: "0 auto 32px",
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Billing toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 48 }} className="fadeUp">
          <span
            onClick={() => setBilling("monthly")}
            style={{
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              color: billing === "monthly" ? "var(--paper)" : "var(--paper-dim)",
              transition: "color 0.2s"
            }}
          >
            Monthly
          </span>
          
          <button
            onClick={() => setBilling(billing === "monthly" ? "annual" : "monthly")}
            style={{
              position: "relative",
              display: "inline-flex",
              height: 24,
              width: 48,
              alignItems: "center",
              borderRadius: 99,
              background: "var(--ink-3)",
              border: "none",
              cursor: "pointer",
              transition: "background 0.2s",
              padding: 0
            }}
          >
            <span
              style={{
                display: "inline-block",
                height: 18,
                width: 18,
                borderRadius: "50%",
                background: "var(--lamp)",
                transition: "transform 0.2s",
                transform: billing === "annual" ? "translateX(26px)" : "translateX(4px)"
              }}
            />
          </button>
          
          <span
            onClick={() => setBilling("annual")}
            style={{
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              color: billing === "annual" ? "var(--paper)" : "var(--paper-dim)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "color 0.2s"
            }}
          >
            Annual
            <span style={{
              borderRadius: 99,
              background: "rgba(244,184,96,0.12)",
              color: "var(--lamp-soft)",
              padding: "2px 8px",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              Save up to 36%
            </span>
          </span>
        </div>

        {/* Plan Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32, maxWidth: 1040, margin: "0 auto" }} className="fadeUp">
          {plans.map((plan) => {
            const isHighlighted = plan.highlighted;
            return (
              <div
                key={plan.name}
                style={{
                  background: "var(--ink-2)",
                  border: isHighlighted ? "1px solid var(--lamp)" : "1px solid var(--ink-3)",
                  borderRadius: 24,
                  padding: 32,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 28,
                  position: "relative",
                  boxShadow: isHighlighted 
                    ? "0 20px 40px rgba(244,184,96,0.08), 0 1px 2px rgba(244,184,96,0.05)" 
                    : "0 10px 30px rgba(0,0,0,0.2)"
                }}
              >
                {isHighlighted && (
                  <span style={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    borderRadius: 99,
                    background: "var(--lamp)",
                    color: "var(--ink-0)",
                    padding: "4px 12px",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                  }}>
                    Most Popular
                  </span>
                )}
                
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <h2 className="serif" style={{ fontSize: 24, color: "var(--paper)", margin: 0, fontWeight: "bold" }}>
                      {plan.name}
                    </h2>
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    {plan.plan === null ? (
                      <>
                        <span style={{ fontSize: 40, fontWeight: 700, color: "var(--paper)" }}>{plan.monthlyPrice}</span>
                        <span style={{ fontSize: 14, color: "var(--paper-dim)" }}>{plan.period}</span>
                      </>
                    ) : billing === "monthly" ? (
                      <>
                        <span style={{ fontSize: 40, fontWeight: 700, color: "var(--paper)" }}>{plan.monthlyPrice}</span>
                        <span style={{ fontSize: 14, color: "var(--paper-dim)" }}>{plan.period}</span>
                      </>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                          <span style={{ fontSize: 40, fontWeight: 700, color: "var(--paper)" }}>{plan.annualPrice}</span>
                          <span style={{ fontSize: 14, color: "var(--paper-dim)" }}>/year</span>
                        </div>
                        <p style={{ fontSize: 11, color: "var(--paper-mute)", margin: "4px 0 0 0" }} className="mono">
                          ({plan.annualMonthly}/mo equivalent)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                  {plan.features.map((feature) => (
                    <li key={feature} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--paper-dim)" }}>
                      <svg
                        style={{ width: 16, height: 16, color: "var(--lamp-soft)", flexShrink: 0 }}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={3}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <div>
                  {plan.plan ? (
                    <button
                      onClick={() => handleCheckout(plan.plan!)}
                      disabled={loading === plan.plan}
                      style={{
                        width: "100%",
                        padding: "14px",
                        background: isHighlighted ? "var(--lamp)" : "transparent",
                        color: isHighlighted ? "var(--ink-0)" : "var(--paper)",
                        border: isHighlighted ? "none" : "1px solid var(--ink-3)",
                        borderRadius: 16,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        transition: "all 0.2s"
                      }}
                      className="hover:opacity-90 active:scale-95"
                    >
                      {loading === plan.plan ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Redirecting...
                        </>
                      ) : plan.cta}
                    </button>
                  ) : (
                    <Link
                      href={plan.href!}
                      style={{
                        width: "100%",
                        padding: "14px",
                        background: "transparent",
                        color: "var(--paper)",
                        border: "1px solid var(--ink-3)",
                        borderRadius: 16,
                        fontSize: 14,
                        fontWeight: 600,
                        textAlign: "center",
                        textDecoration: "none",
                        display: "block",
                        transition: "all 0.2s"
                      }}
                      className="hover:bg-white/5 active:scale-95"
                    >
                      {plan.cta}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </TwilightShell>
  );
}
