"use client";

import { useState } from "react";
import Link from "next/link";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "1 family voice",
      "10 clips per month",
      "Basic content library",
    ],
    cta: "Get Started",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$9.99",
    period: "/month",
    features: [
      "3 family voices",
      "100 clips per month",
      "Full content library",
      "Priority processing",
    ],
    cta: "Upgrade to Pro",
    plan: "pro",
    highlighted: true,
  },
  {
    name: "Family",
    price: "$19.99",
    period: "/month",
    features: [
      "8 family voices",
      "500 clips per month",
      "Full content library",
      "Priority processing",
      "Family sharing",
    ],
    cta: "Upgrade to Family",
    plan: "family",
    highlighted: false,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(plan: string) {
    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
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
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
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
