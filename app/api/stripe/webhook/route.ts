import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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
      {
        error: `Webhook signature verification failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan;

      if (userId && plan) {
        await supabase.from("users").update({ plan }).eq("id", userId);
      }
      break;
    }

    case "customer.subscription.updated": {
      // Handle plan changes (upgrades, downgrades, renewals)
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (user && subscription.status === "active") {
        // Derive plan from subscription metadata or price ID
        const plan = subscription.metadata?.plan;
        if (plan === "family" || plan === "premium") {
          await supabase.from("users").update({ plan }).eq("id", user.id);
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (user) {
        await supabase
          .from("users")
          .update({ plan: "free" })
          .eq("id", user.id);
      }
      break;
    }

    case "invoice.paid": {
      // Confirm successful renewal — ensure the plan stays active
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const { data: user } = await supabase
        .from("users")
        .select("id, plan")
        .eq("stripe_customer_id", customerId)
        .single();

      // If plan was previously downgraded due to a failed payment, restore it
      if (user && invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        );
        const plan = subscription.metadata?.plan;
        if (plan === "family" || plan === "premium") {
          await supabase.from("users").update({ plan }).eq("id", user.id);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (user) {
        // Downgrade to free until payment is resolved
        await supabase
          .from("users")
          .update({ plan: "free" })
          .eq("id", user.id);
      }
      // TODO: Send email notification about failed payment
      break;
    }

    case "checkout.session.expired": {
      // Abandoned checkout — no action required, logged for awareness
      break;
    }
  }

  return NextResponse.json({ received: true });
}
