import { createClient } from "@supabase/supabase-js";

export const PLAN_LIMITS = {
  free: {
    voice_slots: 1,
    clips_per_month: 10,
    content_access: "basic" as const,
  },
  pro: {
    voice_slots: 3,
    clips_per_month: 100,
    content_access: "all" as const,
  },
  family: {
    voice_slots: 8,
    clips_per_month: 500,
    content_access: "all" as const,
  },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;
export type Action = "add_voice" | "generate_clip" | "premium_content";

interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  upgradePrompt?: string;
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Check whether a user is allowed to perform a given action
 * based on their current plan and usage.
 */
export async function checkLimit(
  userId: string,
  action: Action
): Promise<LimitCheckResult> {
  const supabase = getAdminClient();

  const { data: user, error } = await supabase
    .from("users")
    .select("plan, voice_slots_used, clips_used_this_month")
    .eq("id", userId)
    .single();

  if (error || !user) {
    return { allowed: false, reason: "User not found" };
  }

  const plan = user.plan as Plan;
  const limits = PLAN_LIMITS[plan];

  switch (action) {
    case "add_voice":
      if (user.voice_slots_used >= limits.voice_slots) {
        return {
          allowed: false,
          reason: `You've used all ${limits.voice_slots} voice slot${limits.voice_slots === 1 ? "" : "s"} on your ${plan} plan.`,
          upgradePrompt:
            plan === "free"
              ? "Upgrade to Pro for up to 3 voices, or Family for 8."
              : plan === "pro"
                ? "Upgrade to Family for up to 8 voice slots."
                : undefined,
        };
      }
      return { allowed: true };

    case "generate_clip":
      if (user.clips_used_this_month >= limits.clips_per_month) {
        return {
          allowed: false,
          reason: `You've used all ${limits.clips_per_month} clips this month.`,
          upgradePrompt:
            plan !== "family"
              ? "Upgrade your plan for more monthly clips."
              : undefined,
        };
      }
      return { allowed: true };

    case "premium_content":
      if (limits.content_access !== "all") {
        return {
          allowed: false,
          reason: "Premium content is available on Pro and Family plans.",
          upgradePrompt: "Upgrade to Pro or Family to access all content.",
        };
      }
      return { allowed: true };

    default:
      return { allowed: false, reason: "Unknown action" };
  }
}
