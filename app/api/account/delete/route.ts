import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { safeJson } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/auth/session";
import { consentOwnedBy, lifecycleOwnedBy, selfUser, voiceOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  consentRecords,
  dataLifecycleRequests,
  familyVoices,
  users,
} from "@/lib/db/schema";
import { deleteObjectPrefix, GCP_PATHS } from "@/lib/gcp";
import { logger } from "@/lib/logger";
import { stripe } from "@/lib/stripe";
import { deleteVoice } from "@/lib/voice-provider";

const schema = z.object({ confirmation: z.literal("DELETE"), email: z.string().email() });

/**
 * True when an external deletion step failed only because the thing it
 * was deleting is already gone. Account deletion runs irreversible
 * external steps (Stripe, voice provider, storage) before the users-row
 * delete, so it cannot be atomic across those systems — instead every
 * step is made retry-safe: if a first attempt dies halfway (502, user
 * row kept), a retry re-runs each step and the ones that already
 * succeeded report "already gone", which counts as success. The retry
 * therefore converges instead of failing forever against a partially
 * deleted account.
 */
function isAlreadyGone(error: unknown): boolean {
  const e = error as {
    code?: string;
    status?: number;
    statusCode?: number;
    raw?: { code?: string };
    message?: string;
  } | null;
  if (!e) return false;
  // Stripe reports a deleted/unknown customer as resource_missing.
  if (e.code === "resource_missing" || e.raw?.code === "resource_missing") return true;
  if (e.status === 404 || e.statusCode === 404) return true;
  const message = (e.message ?? "").toLowerCase();
  return (
    message.includes("no such customer") ||
    message.includes("not found") ||
    message.includes("unknown voice")
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const json = await safeJson(request);
  if ("error" in json) return json.error;
  const parsed = schema.safeParse(json.body);
  if (!parsed.success || parsed.data.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "Enter your account email and DELETE exactly." }, { status: 400 });
  }

  await db.insert(dataLifecycleRequests).values({ userId: user.id, requestType: "delete", status: "processing" });
  const voices = await db
    .select({ providerVoiceId: familyVoices.providerVoiceId })
    .from(familyVoices)
    .where(voiceOwnedBy(user.id));
  const [profile] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(selfUser(user.id))
    .limit(1);

  try {
    // External steps first, users row last — and each external step
    // tolerates "already gone" so a retry after a partial failure can
    // complete (see isAlreadyGone). Storage purges are already
    // idempotent: deleteObjectPrefix deletes with ignoreNotFound.
    if (profile?.stripeCustomerId) {
      try {
        await stripe.customers.del(profile.stripeCustomerId);
      } catch (error) {
        if (!isAlreadyGone(error)) throw error;
        logger.info("account_deletion_stripe_customer_already_gone", { userId: user.id });
      }
    }
    await Promise.all(
      voices
        .filter((v) => v.providerVoiceId)
        .map(async (v) => {
          try {
            await deleteVoice(v.providerVoiceId!);
          } catch (error) {
            if (!isAlreadyGone(error)) throw error;
            logger.info("account_deletion_voice_already_gone", { userId: user.id });
          }
        })
    );
    await Promise.all([
      deleteObjectPrefix(`voice-samples/${user.id}/`),
      deleteObjectPrefix(`clips/${user.id}/`),
      deleteObjectPrefix(GCP_PATHS.consentVideoPrefix(user.id)),
    ]);
    // Mark all active consent records as revoked for audit before the user-row
    // delete cascades them
    await db
      .update(consentRecords)
      .set({ revokedAt: new Date() })
      .where(and(consentOwnedBy(user.id), isNull(consentRecords.revokedAt)));
    // Deleting the users row is the Auth.js-era equivalent of the hosted
    // auth admin delete: FK cascades remove accounts/sessions and every
    // user-owned row.
    await db.delete(users).where(selfUser(user.id));
    logger.warn("account_deletion_completed", { userId: user.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown deletion failure";
    await db
      .update(dataLifecycleRequests)
      .set({ status: "failed", failureReason: message })
      .where(
        and(
          lifecycleOwnedBy(user.id),
          eq(dataLifecycleRequests.requestType, "delete"),
          eq(dataLifecycleRequests.status, "processing")
        )
      );
    logger.error("account_deletion_failed", { userId: user.id, message });
    return NextResponse.json({ error: "Deletion did not complete. Support has an auditable failure record." }, { status: 502 });
  }
}
