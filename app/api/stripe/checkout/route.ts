import { getCurrentUser } from "@/lib/auth/session";
import { selfUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";
import { safeJson } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";

const checkoutSchema = z.object({
  plan: z.enum(["family", "premium"]),
  billing: z.enum(["monthly", "annual"]).default("monthly"),
  trial: z.boolean().optional(),
  isTrial: z.boolean().optional(),
});

function getPriceId(priceKey: string): string {
  const envMap: Record<string, string> = {
    family_monthly: "STRIPE_FAMILY_MONTHLY_PRICE_ID",
    family_annual: "STRIPE_FAMILY_ANNUAL_PRICE_ID",
    premium_monthly: "STRIPE_PREMIUM_MONTHLY_PRICE_ID",
    premium_annual: "STRIPE_PREMIUM_ANNUAL_PRICE_ID",
  };
  const envName = envMap[priceKey];
  if (!envName) throw new Error(`Unknown price key: ${priceKey}`);
  const value = process.env[envName];
  if (!value) {
    throw new Error(`${envName} is required. Configure a real Stripe price before checkout.`);
  }
  return value;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const parsed = checkoutSchema.safeParse(parsedJson.body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const { plan, billing } = parsed.data;
  const isTrialConversion = parsed.data.trial === true || parsed.data.isTrial === true;
  const priceKey = `${plan}_${billing}`;

  // Get or create Stripe customer
  const [profile] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(selfUser(user.id))
    .limit(1);

  let customerId = profile?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      // Metadata key name is a Stripe-side contract shared with the
      // webhook handler and already stamped on existing customers —
      // it is kept verbatim despite the legacy name.
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(selfUser(user.id));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const priceId = getPriceId(priceKey);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?upgraded=true${isTrialConversion ? "&trial_converted=true" : ""}`,
    cancel_url: `${appUrl}/pricing${isTrialConversion ? "?trial=true" : ""}`,
    metadata: {
      // Legacy key name is a Stripe-side contract (see customer metadata
      // above + the webhook handler); kept verbatim.
      supabase_user_id: user.id,
      plan,
      ...(isTrialConversion ? {
        trial: "true",
        trial_conversion: "true",
        trial_source: "try_before_you_pay",
      } : {}),
    },
  });

  return NextResponse.json({ url: session.url, trial: isTrialConversion });
}
