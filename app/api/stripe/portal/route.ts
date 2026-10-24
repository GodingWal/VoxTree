import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth/session";
import { selfUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [profile] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(selfUser(userId))
    .limit(1);
  if (!profile?.stripeCustomerId) return NextResponse.json({ error: "No billing account exists yet." }, { status: 404 });
  const returnUrl = new URL("/dashboard/settings", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString();
  const session = await stripe.billingPortal.sessions.create({ customer: profile.stripeCustomerId, return_url: returnUrl });
  return NextResponse.json({ url: session.url });
}
