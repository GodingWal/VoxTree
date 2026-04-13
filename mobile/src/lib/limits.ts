// Mirrored from the Next.js web app's `/lib/limits.ts`. Keep these in sync
// whenever the server-side limits change.

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

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  family: "Family",
  premium: "Premium",
};

export function planLabel(plan: Plan | null | undefined) {
  return PLAN_LABELS[(plan ?? "free") as Plan];
}
