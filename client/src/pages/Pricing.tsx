import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { format } from "date-fns";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { pricingPlans, formatMonthlyPrice, getPricingPlan } from "@/lib/pricing";
import type { SubscriptionPlan } from "@shared/subscriptions";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const currentPlanDetails = useMemo(() => (
    user ? getPricingPlan(user.plan) : undefined
  ), [user]);

  const renewalDate = useMemo(() => {
    if (!user?.planRenewalAt) {
      return null;
    }

    const date = new Date(user.planRenewalAt);
    return Number.isNaN(date.getTime()) ? null : format(date, "PPP");
  }, [user?.planRenewalAt]);

  const checkoutMutation = useMutation({
    mutationFn: async (plan: SubscriptionPlan) => {
      const response = await apiRequest("POST", "/api/billing/checkout", { plan });
      return response.json() as Promise<{ sessionId: string }>;
    },
    onSuccess: async ({ sessionId }) => {
      if (!sessionId) {
        throw new Error("Missing Stripe checkout session identifier");
      }

      if (!stripePromise) {
        toast({
          title: "Checkout created",
          description: "Stripe publishable key is not configured. Please contact support to complete your upgrade.",
          variant: "destructive",
        });
        return;
      }

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Stripe failed to initialize. Please refresh and try again.");
      }

      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) {
        throw new Error(error.message);
      }
    },
    onError: (error) => {
      const message = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "We couldn't start the checkout process. Please try again.";

      toast({
        title: "Upgrade failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleUpgrade = (plan: SubscriptionPlan) => {
    if (plan === "free") {
      return;
    }

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    checkoutMutation.mutate(plan);
  };

  const stripeConfigured = Boolean(publishableKey);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const annualDiscount = 0.2; // 20% off

  const getDisplayPrice = (monthlyPrice: number) => {
    if (monthlyPrice === 0) return "$0";
    if (billingCycle === "annual") {
      const discounted = monthlyPrice * (1 - annualDiscount);
      return formatMonthlyPrice(discounted);
    }
    return formatMonthlyPrice(monthlyPrice);
  };

  // Features that lower tiers are missing (shown greyed out)
  const premiumOnlyFeatures = [
    "HD video exports",
    "No ads",
    "Priority support",
  ];

  const proOnlyFeatures = [
    "4K video exports",
    "Unlimited videos",
    "Unlimited stories",
    "5 voice clones",
    "API access",
  ];

  const faqItems = [
    {
      q: "Can I cancel anytime?",
      a: "Yes! You can cancel your subscription at any time. You'll continue to have access to your paid features until the end of your current billing period.",
    },
    {
      q: "What happens to my videos if I downgrade?",
      a: "Your existing videos are always yours. If you downgrade, you'll keep access to all previously created content but new monthly limits will apply based on your new plan.",
    },
    {
      q: "How does voice cloning work?",
      a: "Record 5 short voice samples using our guided wizard. Our AI analyzes the recordings and creates a voice model that can narrate stories and videos in your voice.",
    },
    {
      q: "Is my family's data safe?",
      a: "Absolutely. We use enterprise-grade encryption for all data. Voice samples and videos are stored securely and never shared with third parties.",
    },
    {
      q: "Can multiple family members use one account?",
      a: "Yes! All plans support family collaboration. Premium and Pro plans offer more voice clone slots so each family member can have their own AI voice.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <section className="text-center space-y-4">
            <Badge variant="outline" className="uppercase tracking-wide">Flexible plans for every family</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Choose the perfect VoxTree plan</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Start free and unlock premium storytelling experiences with advanced voice cloning, cinematic exports,
              and collaborative family workspaces.
            </p>
            {user && (
              <div className="flex flex-col sm:flex-row gap-2 justify-center items-center text-sm text-muted-foreground">
                <span>
                  Current plan: <span className="font-medium text-foreground">{currentPlanDetails?.name ?? user.plan}</span>
                </span>
                {renewalDate && (
                  <span className="flex items-center gap-2">
                    <i className="fas fa-rotate fa-sm text-primary" aria-hidden="true"></i>
                    Renews on {renewalDate}
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Annual / Monthly Toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${billingCycle === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={billingCycle === "annual"}
              onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${billingCycle === "annual" ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${billingCycle === "annual" ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className={`text-sm font-medium ${billingCycle === "annual" ? "text-foreground" : "text-muted-foreground"}`}>
              Annual <Badge variant="secondary" className="ml-1 text-xs">Save 20%</Badge>
            </span>
          </div>

          <section className="grid gap-8 md:grid-cols-3">
            {pricingPlans.map((plan) => {
              const isCurrentPlan = user?.plan === plan.plan;
              const isPaidPlan = plan.plan !== "free";

              const buttonLabel = !stripeConfigured && isPaidPlan
                ? "Contact Us to Upgrade"
                : !isAuthenticated && isPaidPlan
                  ? "Sign in to upgrade"
                  : isCurrentPlan
                    ? "Current plan"
                    : plan.plan === "free"
                      ? "Included"
                      : `Upgrade to ${plan.name}`;

              // Determine missing features to show greyed-out
              const missingFeatures = plan.plan === "free"
                ? premiumOnlyFeatures
                : plan.plan === "premium"
                  ? proOnlyFeatures.filter(f => !plan.features.includes(f))
                  : [];

              return (
                <Card
                  key={plan.plan}
                  className={`relative flex flex-col h-full ${plan.highlight ? 'border-primary shadow-lg' : ''}`}
                >
                  {plan.highlight && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      Most popular
                    </Badge>
                  )}
                  <CardHeader className="space-y-2 pb-6">
                    <CardTitle className="text-2xl flex items-center justify-between">
                      {plan.name}
                      {isCurrentPlan && (
                        <Badge variant="outline" className="text-xs">Active</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      {plan.description}
                    </CardDescription>
                    <div className="text-left">
                      <p className="text-3xl font-bold">
                        {getDisplayPrice(plan.priceMonthly)}
                        <span className="text-base font-normal text-muted-foreground"> / month</span>
                      </p>
                      {billingCycle === "annual" && plan.priceMonthly > 0 && (
                        <p className="text-xs text-muted-foreground line-through">
                          {formatMonthlyPrice(plan.priceMonthly)} / month
                        </p>
                      )}
                      <p className="text-sm text-primary font-medium">{plan.headline}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-3 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <i className="fas fa-check text-primary mt-1" aria-hidden="true"></i>
                          <span>{feature}</span>
                        </li>
                      ))}
                      {/* Show greyed-out features from higher tiers */}
                      {missingFeatures.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 opacity-40">
                          <i className="fas fa-lock text-muted-foreground mt-1" aria-hidden="true"></i>
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="mt-auto">
                    {!stripeConfigured && isPaidPlan ? (
                      <Button
                        className="w-full"
                        variant={plan.highlight ? "default" : "secondary"}
                        onClick={() => navigate("/contact")}
                      >
                        <i className="fas fa-envelope mr-2" aria-hidden="true"></i>
                        Contact Us to Upgrade
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant={plan.highlight ? "default" : "secondary"}
                        disabled={checkoutMutation.isPending || isCurrentPlan || plan.plan === "free"}
                        onClick={() => handleUpgrade(plan.plan)}
                      >
                        {checkoutMutation.isPending && isPaidPlan ? 'Connecting to Stripe…' : buttonLabel}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </section>

          {/* FAQ Section */}
          <section className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-center">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, idx) => (
                <AccordionItem key={idx} value={`faq-${idx}`}>
                  <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        </div>
      </main>
    </div>
  );
}
