#!/usr/bin/env node
/**
 * Stripe bootstrap for the VoxTree pilot (prep tool — run manually).
 *
 * Finds-or-creates the "VoxTree Pilot" product and its $29.99/month
 * USD recurring price, then prints the price ID to put in env as
 * STRIPE_PILOT_PRICE_ID. The pilot price was decided Oct 29, 2026:
 * $29.99/month. Checkout for the pilot opens with pilot invitations
 * (Week 4 of the $500 launch plan); this script is the prep step that
 * makes the price exist before then.
 *
 * Idempotent: the product is found by metadata
 * (voxtree_key = "pilot") with a name fallback, and the price is
 * found by its stable lookup_key ("voxtree_pilot_monthly"), so
 * re-running never duplicates either object. If a price with the
 * lookup_key exists but at a different amount, the script refuses to
 * proceed — Stripe prices are immutable; create a new price
 * deliberately instead of letting a script guess.
 *
 * Safety:
 * - Refuses to run without STRIPE_SECRET_KEY.
 * - Works the same in test and live mode; it prints which mode the
 *   key belongs to (read from the key prefix) so a test price ID is
 *   never pasted into a live env by mistake. A test-mode price ID
 *   only works with test-mode keys, and vice versa.
 * - Creates nothing else: no customers, no subscriptions, no
 *   webhooks. Webhook endpoint + STRIPE_WEBHOOK_SECRET are configured
 *   in the Stripe dashboard separately (see the deploy runbook).
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-bootstrap-pilot.mjs
 *
 * Then set the printed value in the server env:
 *   STRIPE_PILOT_PRICE_ID=price_...
 */
import Stripe from "stripe";

const PILOT = {
  productName: "VoxTree Pilot",
  productDescription:
    "VoxTree founding-family pilot: a stylized animated clone of a consenting adult (parent/grandparent) with their real cloned voice, reading stories for their family. Pilot/waitlist phase — adult clones only.",
  productMetadataKey: "voxtree_key",
  productMetadataValue: "pilot",
  lookupKey: "voxtree_pilot_monthly",
  unitAmount: 2999, // $29.99 — decided Oct 29, 2026. Do not change casually.
  currency: "usd",
  interval: "month",
};

async function findPilotProduct(stripe) {
  // Active products only; paginate defensively (accounts stay small,
  // but a missed page would silently duplicate the product).
  let startingAfter;
  do {
    const page = await stripe.products.list({
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const product of page.data) {
      if (product.metadata?.[PILOT.productMetadataKey] === PILOT.productMetadataValue) {
        return product;
      }
      if (product.name === PILOT.productName) return product;
    }
    startingAfter = page.has_more ? page.data[page.data.length - 1]?.id : undefined;
  } while (startingAfter);
  return null;
}

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error(
      "Refusing to run: STRIPE_SECRET_KEY is not set.\n" +
        "Run with a test key first:  STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-bootstrap-pilot.mjs",
    );
    process.exit(1);
  }
  const mode = secretKey.startsWith("sk_live_")
    ? "LIVE"
    : secretKey.startsWith("sk_test_")
      ? "TEST"
      : "UNKNOWN (unrecognized key prefix — check the key)";

  // Same API version pin as lib/stripe.ts.
  const stripe = new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });

  let product = await findPilotProduct(stripe);
  if (product) {
    console.log(`Product: found existing "${product.name}" (${product.id})`);
  } else {
    product = await stripe.products.create({
      name: PILOT.productName,
      description: PILOT.productDescription,
      metadata: { [PILOT.productMetadataKey]: PILOT.productMetadataValue },
    });
    console.log(`Product: created "${product.name}" (${product.id})`);
  }

  const existing = await stripe.prices.list({
    lookup_keys: [PILOT.lookupKey],
    active: true,
    limit: 1,
  });
  let price = existing.data[0];
  if (price) {
    if (
      price.unit_amount !== PILOT.unitAmount ||
      price.currency !== PILOT.currency ||
      price.recurring?.interval !== PILOT.interval ||
      price.product !== product.id
    ) {
      console.error(
        `Refusing to proceed: lookup_key "${PILOT.lookupKey}" already exists (${price.id}) ` +
          `but is ${price.unit_amount} ${price.currency} / ${price.recurring?.interval} on product ${price.product}, ` +
          `not ${PILOT.unitAmount} ${PILOT.currency} / ${PILOT.interval} on product ${product.id}.\n` +
          "Stripe prices are immutable — resolve this in the dashboard deliberately.",
      );
      process.exit(1);
    }
    console.log(`Price: found existing $${(price.unit_amount / 100).toFixed(2)}/month (${price.id})`);
  } else {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: PILOT.unitAmount,
      currency: PILOT.currency,
      recurring: { interval: PILOT.interval },
      lookup_key: PILOT.lookupKey,
      metadata: { [PILOT.productMetadataKey]: PILOT.productMetadataValue },
    });
    console.log(`Price: created $${(PILOT.unitAmount / 100).toFixed(2)}/month (${price.id})`);
  }

  console.log("");
  console.log(`Mode: ${mode}`);
  console.log("Set this in the server env (and .env.local for local dev):");
  console.log(`STRIPE_PILOT_PRICE_ID=${price.id}`);
}

main().catch((error) => {
  console.error("Stripe pilot bootstrap failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
