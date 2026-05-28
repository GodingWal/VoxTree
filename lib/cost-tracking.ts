import { createAdminClient } from "./supabase/admin";
import type { Plan } from "@/types/database";

/**
 * Per-plan monthly external-API caps. These protect against runaway costs
 * from buggy clients or abusive users — even an unlimited "premium" tier
 * has a hard ceiling that requires manual review to lift.
 *
 * Numbers are intentionally generous for paid plans; the goal is to
 * detect catastrophic bugs, not throttle normal usage.
 */
export const COST_CAPS: Record<Plan, {
  elevenlabsChars: number;
  replicateTrainings: number;
  replicateInferences: number;
}> = {
  free: {
    elevenlabsChars: 10_000,
    replicateTrainings: 1,
    replicateInferences: 10,
  },
  family: {
    elevenlabsChars: 500_000,
    replicateTrainings: 5,
    replicateInferences: 200,
  },
  premium: {
    elevenlabsChars: 2_000_000,
    replicateTrainings: 20,
    replicateInferences: 1_000,
  },
};

export type CostAction =
  | { kind: "elevenlabs_chars"; chars: number }
  | { kind: "replicate_training" }
  | { kind: "replicate_inference" };

export interface CostCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check whether a user can perform a cost-incurring action this month.
 * Resets monthly counters first if the stored usage_reset_at is older than
 * the current month, so a billing-period rollover happens lazily on demand.
 */
export async function checkCostCap(
  userId: string,
  action: CostAction
): Promise<CostCheckResult> {
  const admin = createAdminClient();
  await admin.rpc("reset_usage_if_stale", { p_user_id: userId });

  const { data: user, error } = await admin
    .from("users")
    .select(
      "plan, elevenlabs_chars_used, replicate_trainings_used, replicate_inferences_used"
    )
    .eq("id", userId)
    .single();

  if (error || !user) {
    return { allowed: false, reason: "User not found" };
  }

  const plan = (user.plan as Plan) ?? "free";
  const caps = COST_CAPS[plan];

  switch (action.kind) {
    case "elevenlabs_chars": {
      const projected = (user.elevenlabs_chars_used ?? 0) + action.chars;
      if (projected > caps.elevenlabsChars) {
        return {
          allowed: false,
          reason: `Monthly speech-generation cap reached (${caps.elevenlabsChars.toLocaleString()} characters).`,
        };
      }
      return { allowed: true };
    }
    case "replicate_training": {
      if ((user.replicate_trainings_used ?? 0) + 1 > caps.replicateTrainings) {
        return {
          allowed: false,
          reason: `Monthly model-training cap reached (${caps.replicateTrainings}).`,
        };
      }
      return { allowed: true };
    }
    case "replicate_inference": {
      if ((user.replicate_inferences_used ?? 0) + 1 > caps.replicateInferences) {
        return {
          allowed: false,
          reason: `Monthly model-inference cap reached (${caps.replicateInferences}).`,
        };
      }
      return { allowed: true };
    }
  }
}

/**
 * Record usage atomically after a successful external API call.
 */
export async function recordUsage(
  userId: string,
  action: CostAction
): Promise<void> {
  const admin = createAdminClient();
  await admin.rpc("increment_usage", {
    p_user_id: userId,
    p_elevenlabs_chars: action.kind === "elevenlabs_chars" ? action.chars : 0,
    p_replicate_trainings: action.kind === "replicate_training" ? 1 : 0,
    p_replicate_inferences: action.kind === "replicate_inference" ? 1 : 0,
  });
}
