import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkLoraTrainingStatus } from "@/lib/replicate";

/**
 * Poll the LoRA training status for a voice. Falls back to syncing with
 * Replicate when the local row hasn't been updated by the webhook (useful in
 * local dev where webhooks aren't reachable, and as a safety net in prod).
 */
export async function GET(request: NextRequest) {
  const supabase = getRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const voiceId = request.nextUrl.searchParams.get("voiceId");
  if (!voiceId) return NextResponse.json({ error: "voiceId required" }, { status: 400 });

  const { data: row } = await supabase
    .from("family_voices")
    .select(
      "lora_status, lora_training_id, lora_version, lora_trigger_word, lora_weights_url"
    )
    .eq("id", voiceId)
    .eq("user_id", user.id)
    .single();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If still training and we have a training id, ask Replicate directly so
  // dev flows don't depend on webhook reachability.
  if (row.lora_status === "training" && row.lora_training_id) {
    try {
      const remote = await checkLoraTrainingStatus(row.lora_training_id);
      if (remote.status === "succeeded") {
        const trainedVersion =
          (remote as any).version ||
          (remote as any).output?.version ||
          null;
        const weightsUrl =
          (remote as any).output?.weights ??
          (typeof (remote as any).output === "string"
            ? (remote as any).output
            : null);

        const admin = createAdminClient();
        await admin
          .from("family_voices")
          .update({
            lora_status: "ready",
            lora_version: trainedVersion,
            lora_weights_url: weightsUrl,
          })
          .eq("id", voiceId);

        return NextResponse.json({
          status: "ready",
          version: trainedVersion,
          triggerWord: row.lora_trigger_word,
        });
      }
      if (remote.status === "failed") {
        const admin = createAdminClient();
        await admin
          .from("family_voices")
          .update({ lora_status: "failed" })
          .eq("id", voiceId);
        return NextResponse.json({ status: "failed" });
      }
    } catch {
      // Network hiccup — return the cached status below.
    }
  }

  return NextResponse.json({
    status: row.lora_status ?? "not_started",
    version: row.lora_version,
    triggerWord: row.lora_trigger_word,
  });
}
