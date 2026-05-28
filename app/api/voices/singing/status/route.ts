import { NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkTrainingStatus } from "@/lib/replicate";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get('id');

  if (!voiceId) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: voice } = await supabase
    .from("family_voices")
    .select("*")
    .eq("id", voiceId)
    .single();

  if (!voice || voice.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (voice.rvc_training_status !== "processing" || !voice.rvc_model_id) {
    return NextResponse.json({ status: voice.rvc_training_status });
  }

  // Currently, rvc_model_id holds the Replicate training ID during processing
  const replicateStatus = await checkTrainingStatus(voice.rvc_model_id);

  if (replicateStatus.status === "succeeded") {
    const admin = createAdminClient();
    await admin
      .from("family_voices")
      .update({
        rvc_training_status: "ready",
        rvc_model_id: replicateStatus.version || "simulated_success",
      })
      .eq("id", voiceId);
    
    return NextResponse.json({ status: "ready" });
  } else if (replicateStatus.status === "failed" || replicateStatus.status === "canceled") {
    const admin = createAdminClient();
    const next = replicateStatus.status === "canceled" ? "cancelled" : "failed";
    await admin
      .from("family_voices")
      .update({ rvc_training_status: next })
      .eq("id", voiceId);
    return NextResponse.json({ status: next });
  }

  return NextResponse.json({ status: "processing" });
}
