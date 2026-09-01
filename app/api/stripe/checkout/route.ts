import { getRouteClient } from "@/lib/supabase/auth";
import { stripe } from "@/lib/stripe";
import { safeJson } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";

const checkoutSchema = z.object({
  plan: z.enum(["family", "premium"]),
  billing: z.enum(["monthly", "annual"]).default("monthly"),
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
    if (process.env.NODE_ENV === "production" && process.env.SIMULATION_MODE !== "true") {
      throw new Error(`${envName} is required in production. Set ${envName} or enable SIMULATION_MODE=true.`);
    }
    console.warn(`Missing ${envName} — using placeholder that will fail on Stripe API call.`);
    return `missing_${envName.toLowerCase()}`;
  }
  return value;
}

export async function POST(request: Request) {
  const supabase = await getRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  const priceKey = `${plan}_${billing}`;

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await supabase
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const priceId = getPriceId(priceKey);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?upgraded=true`,
    cancel_url: `${appUrl}/pricing`,
    metadata: { supabase_user_id: user.id, plan },
  });

  return NextResponse.json({ url: session.url });
}
