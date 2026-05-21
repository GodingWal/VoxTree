import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS, planLabel } from "@/lib/limits";
import type { Plan } from "@/types/database";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Mic, User as UserIcon, Activity, AlertTriangle, ChevronRight } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";

import { VoiceCard } from "@/components/voice-card";
import { VoiceSlotsProgress } from "@/components/voice-slots-progress";

export default async function ClonesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("plan, voice_slots_used")
    .eq("id", user.id)
    .single();

  const { data: voices } = await supabase
    .from("family_voices")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const plan = (profile?.plan ?? "free") as Plan;
  const limits = PLAN_LIMITS[plan];
  const voiceSlotsUsed: number = profile?.voice_slots_used ?? 0;
  const atVoiceLimit =
    limits.voice_slots !== null && voiceSlotsUsed >= limits.voice_slots;

  return (
    <main className="container py-8 space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal dark:text-foreground">
            My Clones
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your digital likeness for generating personalized educational content.
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

      {/* Limit Upsell */}
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
                Upgrade your plan to unlock more slots.
              </p>
            </div>
          </div>
          <Link
            href="/pricing"
            className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-gold/90 transition-colors shadow-sm"
          >
            Upgrade Plan
          </Link>
        </div>
      )}

      {/* Radix UI Tabs for Voice, Face, Body */}
      <Tabs.Root defaultValue="voice" className="flex flex-col">
        <Tabs.List className="flex shrink-0 border-b border-muted">
          <Tabs.Trigger
            value="voice"
            className="flex items-center gap-2 px-5 h-[45px] select-none text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:text-brand-green data-[state=active]:border-b-2 data-[state=active]:border-brand-green outline-none"
          >
            <Mic className="h-4 w-4" />
            Voice
          </Tabs.Trigger>
          <Tabs.Trigger
            value="face"
            className="flex items-center gap-2 px-5 h-[45px] select-none text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:text-brand-green data-[state=active]:border-b-2 data-[state=active]:border-brand-green outline-none"
          >
            <UserIcon className="h-4 w-4" />
            Face
          </Tabs.Trigger>
          <Tabs.Trigger
            value="body"
            className="flex items-center gap-2 px-5 h-[45px] select-none text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:text-brand-green data-[state=active]:border-b-2 data-[state=active]:border-brand-green outline-none"
          >
            <Activity className="h-4 w-4" />
            Body
          </Tabs.Trigger>
        </Tabs.List>

        {/* VOICE TAB */}
        <Tabs.Content value="voice" className="py-6 outline-none">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-brand-charcoal dark:text-foreground">
                  Voice Clones
                </h2>
                <div className="w-48 mt-2">
                  <VoiceSlotsProgress
                    used={voiceSlotsUsed}
                    total={limits.voice_slots}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
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
          </div>
        </Tabs.Content>

        {/* FACE TAB */}
        <Tabs.Content value="face" className="py-6 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="relative overflow-hidden rounded-xl border p-12 text-center shadow-lg">
            {/* Dynamic Pulsing Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-sage/20 via-white to-brand-green/10 dark:from-brand-sage/10 dark:via-background dark:to-brand-green/5 animate-pulse" style={{ animationDuration: '3s' }} />
            
            <div className="relative z-10">
              <div className="mx-auto w-20 h-20 rounded-full bg-white dark:bg-card shadow-md flex items-center justify-center mb-6">
                <UserIcon className="h-10 w-10 text-brand-green" />
              </div>
              <h2 className="text-3xl font-bold text-brand-charcoal dark:text-foreground mb-3">
                Face Cloning <span className="text-brand-green text-sm align-super font-black uppercase tracking-widest bg-brand-green/10 px-2 py-0.5 rounded-full ml-2">Coming Soon</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-lg">
                We are working hard to bring you the ability to clone your face for an even more immersive educational experience for your kids. Stay tuned!
              </p>
            </div>
          </div>
        </Tabs.Content>

        {/* BODY TAB */}
        <Tabs.Content value="body" className="py-6 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="relative overflow-hidden rounded-xl border p-12 text-center shadow-lg">
            {/* Dynamic Pulsing Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-coral/10 via-white to-brand-gold/10 dark:from-brand-coral/5 dark:via-background dark:to-brand-gold/5 animate-pulse" style={{ animationDuration: '4s' }} />
            
            <div className="relative z-10">
              <div className="mx-auto w-20 h-20 rounded-full bg-white dark:bg-card shadow-md flex items-center justify-center mb-6">
                <Activity className="h-10 w-10 text-brand-coral" />
              </div>
              <h2 className="text-3xl font-bold text-brand-charcoal dark:text-foreground mb-3">
                Body Cloning <span className="text-brand-coral text-sm align-super font-black uppercase tracking-widest bg-brand-coral/10 px-2 py-0.5 rounded-full ml-2">Coming Soon</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-lg">
                In the future, you&apos;ll be able to create full-body avatars that can move, dance, and interact in our educational videos.
              </p>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </main>
  );
}
