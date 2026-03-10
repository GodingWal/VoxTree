import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS } from "@/lib/limits";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Mic,
  Play,
  BookOpen,
  Plus,
  ArrowUpRight,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  User,
  LogOut,
} from "lucide-react";

import { VoiceCard } from "@/components/voice-card";
import { VoiceSlotsProgress } from "@/components/voice-slots-progress";
import { ActivityFeed } from "@/components/activity-feed";
import { DarkModeToggle } from "@/components/dark-mode-toggle";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: voices } = await supabase
    .from("family_voices")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: recentClips } = await supabase
    .from("generated_clips")
    .select("*, content_library(*), family_voices(name)")
    .eq("user_id", user.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(3);

  const planMap: Record<string, string> = {
    free: "Free",
    family: "Family",
    premium: "Premium",
  };

  const plan = (profile?.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const planLabel = planMap[plan];
  const limits = PLAN_LIMITS[plan];
  const voiceSlotsUsed: number = profile?.voice_slots_used ?? 0;
  const atVoiceLimit =
    limits.voice_slots !== null && voiceSlotsUsed >= limits.voice_slots;

  const firstName =
    user.user_metadata?.full_name?.split(" ")[0] ??
    user.email?.split("@")[0] ??
    "there";

  const voiceCount = voices?.length ?? 0;
  const clipCount = recentClips?.length ?? 0;

  return (
    <div className="min-h-screen bg-brand-cream/40 dark:bg-background">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-green flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-brand-charcoal dark:text-foreground">
              VoxTree
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/browse"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Browse
            </Link>
            <span className="inline-flex items-center rounded-full bg-brand-green/10 text-brand-green px-3 py-1 text-xs font-semibold">
              {planLabel} Plan
            </span>
            <DarkModeToggle />
            <div className="h-8 w-8 rounded-full bg-brand-sage/50 dark:bg-brand-sage/20 flex items-center justify-center">
              <User className="h-4 w-4 text-brand-green" />
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-brand-charcoal dark:text-foreground">
              Welcome back, {firstName}
            </h1>
            <p className="text-muted-foreground mt-1">
              {voiceCount === 0
                ? "Get started by adding your first family voice."
                : `You have ${voiceCount} voice${voiceCount !== 1 ? "s" : ""} and ${clipCount} clip${clipCount !== 1 ? "s" : ""} ready.`}
            </p>
          </div>
          {!atVoiceLimit && (
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-green/90 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Voice
            </Link>
          )}
        </div>

        {/* Voice limit upsell banner */}
        {atVoiceLimit && plan !== "premium" && (
          <div className="rounded-xl border border-brand-gold/30 bg-gradient-to-r from-brand-gold/10 via-brand-gold/5 to-transparent p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-brand-gold/20 p-2">
                <AlertTriangle className="h-4 w-4 text-brand-gold" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-brand-charcoal dark:text-foreground">
                  Voice profile limit reached
                </p>
                <p className="text-sm text-muted-foreground">
                  {plan === "free"
                    ? "You've used your 1 free voice profile. Upgrade to Family for 2, or Premium for unlimited."
                    : "You've used both Family voice profiles. Upgrade to Premium for unlimited."}
                </p>
              </div>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-gold/90 transition-colors shadow-sm"
            >
              Upgrade
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white dark:bg-card border p-5 flex items-center gap-4 shadow-sm">
            <div className="rounded-xl bg-brand-green/10 p-3">
              <Mic className="h-5 w-5 text-brand-green" />
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-charcoal dark:text-foreground">
                {voiceCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Voice{voiceCount !== 1 ? "s" : ""} Added
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-card border p-5 flex items-center gap-4 shadow-sm">
            <div className="rounded-xl bg-brand-coral/10 p-3">
              <Play className="h-5 w-5 text-brand-coral" />
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-charcoal dark:text-foreground">
                {clipCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Clip{clipCount !== 1 ? "s" : ""} Created
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-card border p-5 flex items-center gap-4 shadow-sm">
            <div className="rounded-xl bg-brand-gold/10 p-3">
              <Sparkles className="h-5 w-5 text-brand-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-charcoal dark:text-foreground">
                {planLabel}
              </p>
              <p className="text-xs text-muted-foreground">Current Plan</p>
            </div>
          </div>
        </div>

        {/* Family Voices */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-brand-charcoal dark:text-foreground">
                  Family Voices
                </h2>
                {atVoiceLimit && plan !== "premium" && (
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-1 text-sm text-brand-gold font-medium hover:underline"
                  >
                    Upgrade for more
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
              {/* Voice slots progress bar */}
              <div className="w-48">
                <VoiceSlotsProgress
                  used={voiceSlotsUsed}
                  total={limits.voice_slots}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {voices && voices.length > 0 ? (
              voices.map((voice) => (
                <VoiceCard key={voice.id} voice={voice} />
              ))
            ) : (
              <div className="col-span-full rounded-xl border-2 border-dashed border-brand-sage/40 p-8 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-brand-sage/20 flex items-center justify-center mb-3">
                  <Mic className="h-5 w-5 text-brand-green/60" />
                </div>
                <p className="text-sm font-medium text-brand-charcoal dark:text-foreground">
                  No voices yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a family member&apos;s voice to get started.
                </p>
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-brand-green hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add your first voice
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Activity Feed */}
        <ActivityFeed
          voices={voices ?? []}
          clips={recentClips ?? []}
        />

        {/* Recent Clips */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-brand-charcoal dark:text-foreground">
              Continue Watching
            </h2>
            {recentClips && recentClips.length > 0 && (
              <Link
                href="/browse"
                className="inline-flex items-center gap-1 text-sm text-brand-green font-medium hover:underline"
              >
                View all
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentClips && recentClips.length > 0 ? (
              recentClips.map((clip) => (
                <div
                  key={clip.id}
                  className="group rounded-xl bg-white dark:bg-card border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="aspect-video bg-gradient-to-br from-brand-sage/30 to-brand-green/10 flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full bg-white/80 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Play className="h-5 w-5 text-brand-green ml-0.5" />
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-medium text-brand-charcoal dark:text-foreground truncate">
                      {(clip as Record<string, unknown>).content_library
                        ? (
                            (clip as Record<string, unknown>)
                              .content_library as Record<string, unknown>
                          ).title as string
                        : "Untitled"}
                    </p>
                    {(clip as Record<string, unknown>).family_voices && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Mic className="h-3 w-3" />
                        {
                          (
                            (clip as Record<string, unknown>)
                              .family_voices as Record<string, unknown>
                          ).name as string
                        }
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-xl border-2 border-dashed border-muted p-8 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-brand-coral/10 flex items-center justify-center mb-3">
                  <Play className="h-5 w-5 text-brand-coral/60" />
                </div>
                <p className="text-sm font-medium text-brand-charcoal dark:text-foreground">
                  No clips yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Browse content to create your first personalized video.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Browse CTA */}
        <section className="rounded-2xl bg-gradient-to-br from-brand-green to-brand-green/80 p-8 sm:p-10 text-center space-y-4 shadow-lg">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            Discover Educational Content
          </h2>
          <p className="text-white/80 max-w-md mx-auto">
            Browse our library of children&apos;s educational videos and hear
            them narrated in your family&apos;s voice.
          </p>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-green hover:bg-white/90 transition-colors shadow-sm"
          >
            <BookOpen className="h-4 w-4" />
            Browse Content
          </Link>
        </section>
      </main>
    </div>
  );
}
