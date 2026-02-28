import { createClient } from "@supabase/supabase-js";

// null means unlimited
export const PLAN_LIMITS = {
  free: {
    voice_slots: 1,
    videos: 2,
    stories: 4,
    content_access: "basic" as const,
  },
  family: {
    voice_slots: 2,
    videos: null,
    stories: null,
    content_access: "all" as const,
  },
  premium: {
    voice_slots: null,
    videos: null,
    stories: null,
    content_access: "all" as const,
  },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;
export type Action =
  | "add_voice"
  | "add_video"
  | "add_story"
  | "premium_content";

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
    .select("plan, voice_slots_used, videos_used, stories_used")
    .eq("id", userId)
    .single();

  if (error || !user) {
    return { allowed: false, reason: "User not found" };
  }

  const plan = user.plan as Plan;
  const limits = PLAN_LIMITS[plan];

  switch (action) {
    case "add_voice": {
      if (limits.voice_slots !== null && user.voice_slots_used >= limits.voice_slots) {
        return {
          allowed: false,
          reason: `You've used all ${limits.voice_slots} voice profile${limits.voice_slots === 1 ? "" : "s"} on your ${plan === "free" ? "Free" : "Family"} plan.`,
          upgradePrompt:
            plan === "free"
              ? "Upgrade to Family for 2 voice profiles, or Premium for unlimited."
              : plan === "family"
                ? "Upgrade to Premium for unlimited voice profiles."
                : undefined,
        };
      }
      return { allowed: true };
    }

    case "add_video": {
      if (limits.videos !== null && user.videos_used >= limits.videos) {
        return {
          allowed: false,
          reason: `You've reached the ${limits.videos}-video limit on the Free plan.`,
          upgradePrompt:
            "Upgrade to Family or Premium for unlimited videos.",
        };
      }
      return { allowed: true };
    }

    case "add_story": {
      if (limits.stories !== null && user.stories_used >= limits.stories) {
        return {
          allowed: false,
          reason: `You've reached the ${limits.stories}-story limit on the Free plan.`,
          upgradePrompt:
            "Upgrade to Family or Premium for unlimited stories.",
        };
      }
      return { allowed: true };
    }

    case "premium_content": {
      if (limits.content_access !== "all") {
        return {
          allowed: false,
          reason: "Premium content is available on Family and Premium plans.",
          upgradePrompt:
            "Upgrade to Family or Premium to access the full content library.",
        };
      }
      return { allowed: true };
    }

    default:
      return { allowed: false, reason: "Unknown action" };
  }
}
