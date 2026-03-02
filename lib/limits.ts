import { adminClient } from "@/lib/supabase/admin";

// null means unlimited
export const PLAN_LIMITS = {
  free: {
    voice_slots: 1,
    videos: 2,
    stories: 4,
    clips_per_month: 5,
    content_access: "basic" as const,
  },
  family: {
    voice_slots: 2,
    videos: null,
    stories: null,
    clips_per_month: 30,
    content_access: "all" as const,
  },
  pro: {
    voice_slots: 5,
    videos: null,
    stories: null,
    clips_per_month: 100,
    content_access: "all" as const,
  },
  premium: {
    voice_slots: null,
    videos: null,
    stories: null,
    clips_per_month: null,
    content_access: "all" as const,
  },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;
export type Action =
  | "add_voice"
  | "add_video"
  | "add_story"
  | "generate_clip"
  | "premium_content";

interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  upgradePrompt?: string;
}



/**
 * Check whether a user is allowed to perform a given action
 * based on their current plan and usage.
 */
export async function checkLimit(
  userId: string,
  action: Action
): Promise<LimitCheckResult> {
  const { data: userRow } = await adminClient
    .from("users")
    .select("plan, voice_slots_used, videos_used, stories_used, clips_used_this_month")
    .eq("id", userId)
    .single();

  // If the profile row doesn't exist yet (e.g. trigger not fired for new sign-up),
  // treat the user as a fresh free-plan account with zero usage.
  const user = userRow ?? {
    plan: "free",
    voice_slots_used: 0,
    videos_used: 0,
    stories_used: 0,
    clips_used_this_month: 0,
  };

  const plan = (user.plan ?? "free") as Plan;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  switch (action) {
    case "add_voice": {
      if (limits.voice_slots !== null && user.voice_slots_used >= limits.voice_slots) {
        return {
          allowed: false,
          reason: `You've used all ${limits.voice_slots} voice profile${limits.voice_slots === 1 ? "" : "s"} on your ${plan} plan.`,
          upgradePrompt:
            plan === "free"
              ? "Upgrade to Family for 2 voice profiles, or Premium for unlimited."
              : "Upgrade to Premium for unlimited voice profiles.",
        };
      }
      return { allowed: true };
    }

    case "add_video": {
      if (limits.videos !== null && (user.videos_used ?? 0) >= limits.videos) {
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
      if (limits.stories !== null && (user.stories_used ?? 0) >= limits.stories) {
        return {
          allowed: false,
          reason: `You've reached the ${limits.stories}-story limit on the Free plan.`,
          upgradePrompt:
            "Upgrade to Family or Premium for unlimited stories.",
        };
      }
      return { allowed: true };
    }

    case "generate_clip": {
      if (limits.clips_per_month !== null && (user.clips_used_this_month ?? 0) >= limits.clips_per_month) {
        return {
          allowed: false,
          reason: `You've used all ${limits.clips_per_month} clips for this month on the ${plan} plan.`,
          upgradePrompt:
            plan === "free"
              ? "Upgrade to Family for 30 clips/month, or Premium for unlimited."
              : "Upgrade to Premium for unlimited clip generation.",
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
