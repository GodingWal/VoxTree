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
    if (profile?.stripeCustomerId) {
      await stripe.customers.del(profile.stripeCustomerId);
    }
    await Promise.all(voices.filter((v) => v.providerVoiceId).map((v) => deleteVoice(v.providerVoiceId!)));
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
