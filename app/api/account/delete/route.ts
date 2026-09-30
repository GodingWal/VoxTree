import { NextResponse } from "next/server";
import { z } from "zod";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteVoice } from "@/lib/elevenlabs";
import { deleteObjectPrefix, GCP_PATHS } from "@/lib/gcp";
import { safeJson } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { stripe } from "@/lib/stripe";

const schema = z.object({ confirmation: z.literal("DELETE"), email: z.string().email() });

export async function POST(request: Request) {
  const supabase = await getRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const json = await safeJson(request);
  if ("error" in json) return json.error;
  const parsed = schema.safeParse(json.body);
  if (!parsed.success || parsed.data.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "Enter your account email and DELETE exactly." }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from("data_lifecycle_requests").insert({ user_id: user.id, request_type: "delete", status: "processing" });
  const { data: voices } = await admin.from("family_voices").select("elevenlabs_voice_id").eq("user_id", user.id);
  const { data: profile } = await admin.from("users").select("stripe_customer_id").eq("id", user.id).single();

  try {
    if (profile?.stripe_customer_id) {
      await stripe.customers.del(profile.stripe_customer_id);
    }
    await Promise.all((voices ?? []).filter((v) => v.elevenlabs_voice_id).map((v) => deleteVoice(v.elevenlabs_voice_id!)));
    await Promise.all([
      deleteObjectPrefix(`voice-samples/${user.id}/`),
      deleteObjectPrefix(`clips/${user.id}/`),
      deleteObjectPrefix(GCP_PATHS.consentVideoPrefix(user.id)),
    ]);
    // Mark all active consent records as revoked for audit before auth delete cascades them
    await admin.from("consent_records").update({ revoked_at: new Date().toISOString() }).eq("user_id", user.id).is("revoked_at", null);
    const { error: authError } = await admin.auth.admin.deleteUser(user.id);
    if (authError) throw authError;
    logger.warn("account_deletion_completed", { userId: user.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown deletion failure";
    await admin
      .from("data_lifecycle_requests")
      .update({ status: "failed", failure_reason: message })
      .eq("user_id", user.id)
      .eq("request_type", "delete")
      .eq("status", "processing");
    logger.error("account_deletion_failed", { userId: user.id, message });
    return NextResponse.json({ error: "Deletion did not complete. Support has an auditable failure record." }, { status: 502 });
  }
}
