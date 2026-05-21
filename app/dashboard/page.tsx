import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS, planLabel } from "@/lib/limits";
import type { Plan } from "@/types/database";
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
} from "lucide-react";

import { ActivityFeed } from "@/components/activity-feed";

type DashboardClip = {
  id: string;
  content_library: { title: string } | null;
  family_voices: { name: string } | null;
};

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

  const plan = (profile?.plan ?? "free") as Plan;
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
    <main className="container py-8 space-y-8 max-w-6xl mx-auto">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal dark:text-foreground">
            Welcome back, {firstName}
          </h1>
          <p className="text-muted-foreground mt-1">
            {voiceCount === 0
              ? "Get started by adding your first clone."
              : `You have ${voiceCount} clone${voiceCount !== 1 ? "s" : ""} and ${clipCount} clip${clipCount !== 1 ? "s" : ""} ready.`}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/clones"
            className="inline-flex items-center gap-2 rounded-lg border border-brand-green/20 bg-brand-green/5 px-5 py-2.5 text-sm font-medium text-brand-green hover:bg-brand-green/10 transition-colors shadow-sm"
          >
            Manage Clones
          </Link>
          {!atVoiceLimit && (
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-green/90 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Clone
            </Link>
          )}
        </div>
      </div>

      {/* Limit upsell banner */}
      {atVoiceLimit && plan !== "premium" && (
        <div className="rounded-xl border border-brand-gold/30 bg-gradient-to-r from-brand-gold/10 via-brand-gold/5 to-transparent p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-brand-gold/20 p-2">
              <AlertTriangle className="h-4 w-4 text-brand-gold" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-brand-charcoal dark:text-foreground">
                Clone limit reached
              </p>
              <p className="text-sm text-muted-foreground">
                {plan === "free"
                  ? "You've used your 1 free clone. Upgrade to Family for 2, or Premium for unlimited."
                  : "You've used both Family clones. Upgrade to Premium for unlimited."}
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
        <div className="group rounded-xl bg-white dark:bg-card border p-5 flex items-center gap-4 shadow-sm relative overflow-hidden hover:-translate-y-1 hover:shadow-md transition-all">
          <div className="rounded-xl bg-brand-green/10 p-3 relative z-10">
            <Mic className="h-5 w-5 text-brand-green" />
          </div>
          <div className="relative z-10">
            <p className="text-2xl font-bold text-brand-charcoal dark:text-foreground">
              {voiceCount}
            </p>
            <p className="text-xs text-muted-foreground">
              Clone{voiceCount !== 1 ? "s" : ""} Added
            </p>
          </div>
        </div>
        <div className="group rounded-xl bg-white dark:bg-card border p-5 flex items-center gap-4 shadow-sm relative overflow-hidden hover:-translate-y-1 hover:shadow-md transition-all">
          <div className="rounded-xl bg-brand-coral/10 p-3 relative z-10">
            <Play className="h-5 w-5 text-brand-coral" />
          </div>
          <div className="relative z-10">
            <p className="text-2xl font-bold text-brand-charcoal dark:text-foreground">
              {clipCount}
            </p>
            <p className="text-xs text-muted-foreground">
              Clip{clipCount !== 1 ? "s" : ""} Created
            </p>
          </div>
          {/* Subtle Background Sparkline */}
          <div className="absolute right-0 bottom-0 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 60C10 45 20 50 30 35C40 20 50 25 60 15C70 5 80 15 90 10C100 5 110 5 120 0V60H0Z" fill="currentColor" className="text-brand-coral" />
              <path d="M0 60C10 45 20 50 30 35C40 20 50 25 60 15C70 5 80 15 90 10C100 5 110 5 120 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-coral" />
            </svg>
          </div>
        </div>
        <div className="group rounded-xl bg-white dark:bg-card border p-5 flex items-center gap-4 shadow-sm relative overflow-hidden hover:-translate-y-1 hover:shadow-md transition-all">
          <div className="rounded-xl bg-brand-gold/10 p-3 relative z-10">
            <Sparkles className="h-5 w-5 text-brand-gold" />
          </div>
          <div className="relative z-10">
            <p className="text-2xl font-bold text-brand-charcoal dark:text-foreground">
              {planLabel(plan)}
            </p>
            <p className="text-xs text-muted-foreground">Current Plan</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* Left Column: Recent Clips and CTA */}
        <div className="space-y-8">
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
            <div className="grid gap-4 sm:grid-cols-2">
              {recentClips && recentClips.length > 0 ? (
                (recentClips as DashboardClip[]).map((clip) => (
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
                        {clip.content_library?.title ?? "Untitled"}
                      </p>
                      {clip.family_voices && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Mic className="h-3 w-3" />
                          {clip.family_voices.name}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full rounded-xl border border-muted bg-white/50 dark:bg-card/50 p-10 text-center flex flex-col items-center justify-center">
                  <div className="relative w-32 h-32 mb-4">
                    <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="50" cy="50" r="40" className="fill-brand-sage/20 dark:fill-brand-sage/10" />
                      <circle cx="50" cy="50" r="25" className="fill-brand-coral/20 dark:fill-brand-coral/10" />
                      <path d="M44 38V62L62 50L44 38Z" className="fill-brand-coral" />
                      <path d="M75 25L85 15M25 75L15 85M25 25L15 15M75 75L85 85" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-brand-sage/40 dark:text-brand-sage/20" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-brand-charcoal dark:text-foreground">
                    Your storybook is empty
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    Generate your first personalized educational video to see it appear here.
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
              them narrated with your family&apos;s clones.
            </p>
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-green hover:bg-white/90 transition-colors shadow-sm"
            >
              <BookOpen className="h-4 w-4" />
              Browse Content
            </Link>
          </section>
        </div>

        {/* Right Column: Activity Feed */}
        <div className="hidden lg:block">
          <ActivityFeed
            voices={voices ?? []}
            clips={recentClips ?? []}
          />
        </div>
      </div>
    </main>
  );
}
