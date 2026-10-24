import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth/session";
import { hasActiveConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import { familyVoices } from "@/lib/db/schema";
import { checkTrainingStatus } from "@/lib/replicate";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get('id');

  if (!voiceId) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };

  const [voice] = await db
    .select()
    .from(familyVoices)
    .where(eq(familyVoices.id, voiceId))
    .limit(1);

  if (!voice || voice.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (voice.rvcTrainingStatus !== "processing" || !voice.rvcModelId) {
    return NextResponse.json({ status: voice.rvcTrainingStatus });
  }

  // Revoked consent must not be bypassed by the polling completion path.
  if (!(await hasActiveConsent(user.id))) {
    await db
      .update(familyVoices)
      .set({ rvcTrainingStatus: "failed", rvcModelId: null })
      .where(eq(familyVoices.id, voiceId));
    return NextResponse.json({ status: "failed", consentRequired: true }, { status: 403 });
  }

  // Currently, rvc_model_id holds the Replicate training ID during processing
  const replicateStatus = await checkTrainingStatus(voice.rvcModelId);

  if (replicateStatus.status === "succeeded") {
    if (!replicateStatus.version) {
      return NextResponse.json({ error: "Training completed without a model version" }, { status: 502 });
    }
    await db
      .update(familyVoices)
      .set({
        rvcTrainingStatus: "ready",
        rvcModelId: replicateStatus.version,
      })
      .where(eq(familyVoices.id, voiceId));

    return NextResponse.json({ status: "ready" });
  } else if (replicateStatus.status === "failed" || replicateStatus.status === "canceled") {
    const next = replicateStatus.status === "canceled" ? "cancelled" : "failed";
    await db
      .update(familyVoices)
      .set({ rvcTrainingStatus: next })
      .where(eq(familyVoices.id, voiceId));
    return NextResponse.json({ status: next });
  }

  return NextResponse.json({ status: "processing" });
}
