import { NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { GCP_PATHS, listObjectsWithDownloadUrls } from "@/lib/gcp";

const TABLES = [
  "users",
  "family_voices",
  "family_children",
  "family_invitations",
  "generated_clips",
  "library_selections",
  "library_progress",
  "voice_jobs",
  "consent_records",
  "data_lifecycle_requests",
] as const;

export async function GET() {
  const supabase = await getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: lifecycleRequest } = await admin
    .from("data_lifecycle_requests")
    .insert({ user_id: user.id, request_type: "export", status: "processing" })
    .select("id")
    .single();
  const data: Record<string, unknown> = {};

  for (const table of TABLES) {
    const ownerColumn = table === "users" ? "id" : "user_id";
    const { data: rows, error } = await admin.from(table).select("*").eq(ownerColumn, user.id);
    data[table] = error ? { unavailable: true } : rows;
  }

  // Stored media (voice samples, rendered clips, consent proof) as expiring signed URLs.
  let media: unknown;
  try {
    media = await listObjectsWithDownloadUrls([
      `voice-samples/${user.id}/`,
      `clips/${user.id}/`,
      GCP_PATHS.consentVideoPrefix(user.id),
    ]);
  } catch (e) {
    logger.error("account_export_media_failed", { userId: user.id, message: e instanceof Error ? e.message : String(e) });
    media = { unavailable: true };
  }

  logger.info("account_export_completed", { userId: user.id });
  if (lifecycleRequest?.id) {
    await admin.from("data_lifecycle_requests").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", lifecycleRequest.id);
  }
  return NextResponse.json(
    { exportedAt: new Date().toISOString(), accountEmail: user.email, data, media, mediaLinksExpireInSeconds: 3600 },
    {
      headers: {
        "Content-Disposition": `attachment; filename="voxtree-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
