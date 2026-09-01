import { NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const supabase = await getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("stripe_customer_id").eq("id", user.id).single();
  if (!profile?.stripe_customer_id) return NextResponse.json({ error: "No billing account exists yet." }, { status: 404 });
  const returnUrl = new URL("/dashboard/settings", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString();
  const session = await stripe.billingPortal.sessions.create({ customer: profile.stripe_customer_id, return_url: returnUrl });
  return NextResponse.json({ url: session.url });
}
