import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sendTransactionalEmail } from "@/lib/email";
import { sendOperationalAlert } from "@/lib/monitoring";
import { stripe } from "@/lib/stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

async function findUserByCustomerId(customerId: string) {
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  return user ?? null;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // Stripe-side metadata key written by /api/stripe/checkout; the name
      // is a legacy contract with Stripe and is intentionally unchanged.
      const userId = session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan;

      if (userId && plan) {
        await db
          .update(users)
          .set({ plan })
          .where(eq(users.id, userId));
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const user = await findUserByCustomerId(customerId);

      if (user) {
        await db
          .update(users)
          .set({ plan: "free" })
          .where(eq(users.id, user.id));
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const metadataPlan = subscription.metadata?.plan;

      if (metadataPlan) {
        const user = await findUserByCustomerId(customerId);

        if (user) {
          await db
            .update(users)
            .set({ plan: metadataPlan })
            .where(eq(users.id, user.id));
        }
      }
      break;
    }

    case "invoice.paid": {
      // Logic to confirm successful renewal can be placed here.
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await sendOperationalAlert("stripe_payment_failed", { invoiceId: invoice.id, customerId: invoice.customer });
      const billingUser = await findUserByCustomerId(invoice.customer as string);
      if (billingUser?.email) {
        await sendTransactionalEmail({ to: billingUser.email, template: "payment-failed", data: { invoiceId: invoice.id } });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
