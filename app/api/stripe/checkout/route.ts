import { getRouteClient } from "@/lib/supabase/auth";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const PRICE_IDS: Record<string, string> = {
  family_monthly:
    process.env.STRIPE_FAMILY_MONTHLY_PRICE_ID ?? "price_family_monthly",
  family_annual:
    process.env.STRIPE_FAMILY_ANNUAL_PRICE_ID ?? "price_family_annual",
  premium_monthly:
    process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID ?? "price_premium_monthly",
  premium_annual:
    process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID ?? "price_premium_annual",
};

const checkoutSchema = z.object({
  plan: z.enum(["family", "premium"]),
  billing: z.enum(["monthly", "annual"]).default("monthly"),
});

export async function POST(request: Request) {
  const supabase = getRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = checkoutSchema.safeParse(body);

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

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: PRICE_IDS[priceKey], quantity: 1 }],
    success_url: `${appUrl}/dashboard?upgraded=true`,
    cancel_url: `${appUrl}/pricing`,
    metadata: { supabase_user_id: user.id, plan },
  });

  return NextResponse.json({ url: session.url });
}
