import { NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function POST() {
  const supabase = await getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("users").update({ consent_verified: false }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Consent could not be revoked" }, { status: 500 });
  await admin.from("consent_records").update({ revoked_at: now }).eq("user_id", user.id).is("revoked_at", null);
  await admin.from("data_lifecycle_requests").insert({ user_id: user.id, request_type: "revoke_consent", status: "completed", completed_at: now });
  logger.warn("account_consent_revoked", { userId: user.id });
  return NextResponse.json({ success: true });
}
