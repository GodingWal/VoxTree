import { sql } from "drizzle-orm";

import type { Plan } from "@/types/database";

import { selfUser } from "./authz";
import { db } from "./db";
import { users } from "./db/schema";

/**
 * Per-plan monthly external-API caps. These protect against runaway costs
 * from buggy clients or abusive users — even an unlimited "premium" tier
 * has a hard ceiling that requires manual review to lift.
 *
 * Numbers are intentionally generous for paid plans; the goal is to
 * detect catastrophic bugs, not throttle normal usage.
 */
export const COST_CAPS: Record<Plan, {
  ttsChars: number;
  replicateTrainings: number;
  replicateInferences: number;
}> = {
  free: {
    ttsChars: 10_000,
    replicateTrainings: 1,
    replicateInferences: 10,
  },
  family: {
    ttsChars: 500_000,
    replicateTrainings: 5,
    replicateInferences: 200,
  },
  premium: {
    ttsChars: 2_000_000,
    replicateTrainings: 20,
    replicateInferences: 1_000,
  },
};

export type CostAction =
  | { kind: "tts_chars"; chars: number }
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
 *
 * Usage counters live on the `users` row; the speech-character counter is
 * the `tts_chars_used` column, metered by the `tts_chars` action kind.
 */
export async function checkCostCap(
  userId: string,
  action: CostAction
): Promise<CostCheckResult> {
  await db.execute(sql`select reset_usage_if_stale(${userId})`);

  const [user] = await db
    .select({
      plan: users.plan,
      ttsCharsUsed: users.ttsCharsUsed,
      replicateTrainingsUsed: users.replicateTrainingsUsed,
      replicateInferencesUsed: users.replicateInferencesUsed,
    })
    .from(users)
    .where(selfUser(userId))
    .limit(1);

  if (!user) {
    return { allowed: false, reason: "User not found" };
  }

  const plan = (user.plan as Plan) ?? "free";
  const caps = COST_CAPS[plan];

  switch (action.kind) {
    case "tts_chars": {
      const projected = (user.ttsCharsUsed ?? 0) + action.chars;
      if (projected > caps.ttsChars) {
        return {
          allowed: false,
          reason: `Monthly speech-generation cap reached (${caps.ttsChars.toLocaleString()} characters).`,
        };
      }
      return { allowed: true };
    }
    case "replicate_training": {
      if ((user.replicateTrainingsUsed ?? 0) + 1 > caps.replicateTrainings) {
        return {
          allowed: false,
          reason: `Monthly model-training cap reached (${caps.replicateTrainings}).`,
        };
      }
      return { allowed: true };
    }
    case "replicate_inference": {
      if ((user.replicateInferencesUsed ?? 0) + 1 > caps.replicateInferences) {
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
  await db.execute(
    sql`select increment_usage(${userId}, ${
      action.kind === "tts_chars" ? action.chars : 0
    }, ${action.kind === "replicate_training" ? 1 : 0}, ${
      action.kind === "replicate_inference" ? 1 : 0
    })`
  );
}
