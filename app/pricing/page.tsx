"use client";

import { useState } from "react";
import Link from "next/link";

type BillingPeriod = "monthly" | "annual";

const plans = [
  {
    name: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    period: "forever",
    features: [
      "1 voice profile",
      "2 videos",
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
      "2 voice profiles",
      "Full content library",
      "Unlimited videos & stories",
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
      "Unlimited voice profiles",
      "Full content library",
      "Unlimited videos & stories",
      "Priority processing",
      "Early access to new content",
      "Offline downloads",
    ],
    cta: "Upgrade to Premium",
    plan: "premium" as const,
    highlighted: false,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function handleCheckout(plan: "family" | "premium") {
    setLoading(plan);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(
          data.error ?? "Could not start checkout. Please try again."
        );
      }
    } catch {
      setCheckoutError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center">
          <Link href="/" className="text-xl font-bold text-brand-green">
            VoxTree
          </Link>
        </div>
      </header>

      <main className="container py-16 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Simple, Transparent Pricing</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade as your family grows. Every plan includes
            our core voice cloning technology.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3">
          <span
            className={`text-sm font-medium ${billing === "monthly" ? "text-foreground" : "text-muted-foreground"}`}
          >
            Monthly
          </span>
          <button
            onClick={() =>
              setBilling(billing === "monthly" ? "annual" : "monthly")
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              billing === "annual" ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                billing === "annual" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium ${billing === "annual" ? "text-foreground" : "text-muted-foreground"}`}
          >
            Annual
            <span className="ml-1.5 rounded-full bg-brand-green/10 px-2 py-0.5 text-xs font-semibold text-brand-green">
              Save up to 36%
            </span>
          </span>
        </div>

        {checkoutError && (
          <div className="max-w-5xl mx-auto rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive text-center">
            {checkoutError}
          </div>
        )}

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-6 space-y-6 ${
                plan.highlighted
                  ? "border-primary shadow-lg ring-1 ring-primary relative"
                  : ""
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </span>
              )}
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">{plan.name}</h2>
                <div className="flex items-baseline gap-1">
                  {plan.plan === null ? (
                    <>
                      <span className="text-3xl font-bold">{plan.monthlyPrice}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </>
                  ) : billing === "monthly" ? (
                    <>
                      <span className="text-3xl font-bold">{plan.monthlyPrice}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">{plan.annualPrice}</span>
                        <span className="text-muted-foreground">/year</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ({plan.annualMonthly}/mo)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <svg
                      className="h-4 w-4 text-brand-green shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
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

              {plan.plan ? (
                <button
                  onClick={() => handleCheckout(plan.plan!)}
                  disabled={loading === plan.plan}
                  className={`inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                    plan.highlighted
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {loading === plan.plan ? "Redirecting..." : plan.cta}
                </button>
              ) : (
                <Link
                  href={plan.href!}
                  className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
