import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS } from "@/lib/limits";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import Link from "next/link";
import { FamilyVoicesList } from "@/components/dashboard/FamilyVoicesList";

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
    .limit(6);

  const plan = (profile?.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan];
  const voiceSlotsUsed: number = profile?.voice_slots_used ?? 0;
  const clipsUsed: number = profile?.clips_used_this_month ?? 0;
  const atVoiceLimit =
    limits.voice_slots !== null && voiceSlotsUsed >= limits.voice_slots;
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="min-h-screen bg-background">
      <Nav plan={plan} />

      {/* ✨ Hero Section — animated gradient with floating decorations */}
      <section className="relative overflow-hidden hero-gradient py-16 sm:py-24">
        {/* Floating decorative elements */}
        <div className="absolute top-8 left-[8%] text-4xl float-element opacity-60 select-none" style={{ animationDelay: "0s" }}>🌳</div>
        <div className="absolute top-12 right-[12%] text-3xl float-element-reverse opacity-50 select-none" style={{ animationDelay: "1s" }}>⭐</div>
        <div className="absolute bottom-10 left-[15%] text-2xl float-element opacity-40 select-none" style={{ animationDelay: "2s" }}>✨</div>
        <div className="absolute top-20 right-[30%] text-2xl float-element-reverse opacity-30 select-none hidden sm:block" style={{ animationDelay: "0.5s" }}>🌟</div>
        <div className="absolute bottom-8 right-[8%] text-3xl float-element opacity-50 select-none hidden sm:block" style={{ animationDelay: "1.5s" }}>📖</div>
        <div className="absolute top-1/2 left-[3%] text-xl sparkle-element opacity-40 select-none hidden lg:block" style={{ animationDelay: "0.8s" }}>💫</div>

        {/* Soft glowing orbs */}
        <div className="absolute top-16 right-10 w-40 h-40 bg-brand-gold/20 rounded-full blur-3xl hidden sm:block" />
        <div className="absolute bottom-16 left-10 w-32 h-32 bg-brand-sage/30 rounded-full blur-3xl hidden sm:block" />
        <div className="absolute top-1/2 right-1/3 w-24 h-24 bg-brand-coral/15 rounded-full blur-2xl hidden md:block" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <p className="text-brand-gold font-semibold text-sm uppercase tracking-wider mb-3 animate-fade-in">
              {firstName ? `Welcome back, ${firstName}! 👋` : "Welcome back! 👋"}
            </p>
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6 animate-fade-in">
              <span className="bg-gradient-to-r from-brand-green via-brand-gold to-brand-coral bg-clip-text text-transparent">
                Your Story World
              </span>
              <br />
              <span className="text-3xl md:text-4xl text-foreground/80 font-bold">
                Awaits! 🌟
              </span>
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in">
              Create magical stories with your family&apos;s voices. Clone voices, make amazing videos, and build memories that last forever!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
              <Link
                href="/create"
                className="inline-flex h-14 items-center justify-center rounded-2xl bg-gradient-to-r from-brand-green to-brand-green/80 px-8 text-lg font-bold text-white shadow-lg shadow-brand-green/25 hover:shadow-xl hover:shadow-brand-green/30 hover:scale-105 transition-all duration-300"
              >
                ✨ Start Creating
              </Link>
              <Link
                href="/stories"
                className="inline-flex h-14 items-center justify-center rounded-2xl bg-white border-2 border-brand-gold/40 px-8 text-lg font-bold text-brand-charcoal hover:border-brand-gold hover:bg-brand-cream hover:scale-105 transition-all duration-300 shadow-md"
              >
                📚 Browse Stories
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 🚀 Quick Actions — colorful gradient cards */}
      <section className="py-12 -mt-6 relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 bounce-in-stagger">
            {[
              {
                icon: "🎤",
                title: "Clone Studio",
                desc: "Create your voice twin!",
                href: "/clone",
                gradient: "from-brand-green/10 to-brand-sage/20",
                borderColor: "border-brand-green/30",
                shadowColor: "hover:shadow-brand-green/20",
                iconBg: "bg-brand-green/20",
              },
              {
                icon: "🤖",
                title: "Voice Clone",
                desc: "AI voice magic ✨",
                href: "/clone",
                gradient: "from-brand-lavender/20 to-brand-sky/10",
                borderColor: "border-brand-lavender/30",
                shadowColor: "hover:shadow-brand-lavender/20",
                iconBg: "bg-brand-lavender/30",
              },
              {
                icon: "🎬",
                title: "Create Video",
                desc: "Make family stories!",
                href: "/create",
                gradient: "from-brand-gold/15 to-brand-peach/20",
                borderColor: "border-brand-gold/30",
                shadowColor: "hover:shadow-brand-gold/20",
                iconBg: "bg-brand-gold/20",
              },
              {
                icon: "👥",
                title: "Collaborate",
                desc: "Create together!",
                href: "/videos",
                gradient: "from-brand-coral/10 to-brand-peach/15",
                borderColor: "border-brand-coral/30",
                shadowColor: "hover:shadow-brand-coral/20",
                iconBg: "bg-brand-coral/20",
              },
            ].map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className={`card-hover-lift rounded-2xl border-2 ${action.borderColor} bg-gradient-to-br ${action.gradient} p-5 sm:p-6 group shadow-md ${action.shadowColor} hover:shadow-xl`}
              >
                <div
                  className={`w-14 h-14 ${action.iconBg} rounded-2xl flex items-center justify-center mb-4 group-hover:animate-wiggle`}
                >
                  <span className="text-2xl">{action.icon}</span>
                </div>
                <h3 className="font-bold text-base mb-1">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* 📊 Usage Summary — colorful & playful */}
        <section className="rounded-2xl border-2 border-brand-sage/30 bg-gradient-to-r from-brand-cream/50 to-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <span className="w-8 h-8 bg-brand-green/15 rounded-lg flex items-center justify-center text-sm">📊</span>
            Your Progress
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {/* Voice Profiles */}
            <div className="space-y-3 p-4 rounded-xl bg-white/80 border border-brand-green/10">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎤</span>
                <p className="text-sm font-medium text-muted-foreground">Voice Profiles</p>
              </div>
              <p className="text-3xl font-extrabold text-brand-green">
                {voiceSlotsUsed}
                <span className="text-sm font-normal text-muted-foreground ml-1">/ {limits.voice_slots ?? "∞"}</span>
              </p>
              {limits.voice_slots !== null && (
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                  <div
                    className="progress-gradient h-3 transition-all duration-700 ease-out"
                    style={{ width: `${Math.min((voiceSlotsUsed / limits.voice_slots) * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Clips This Month */}
            <div className="space-y-3 p-4 rounded-xl bg-white/80 border border-brand-gold/10">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎬</span>
                <p className="text-sm font-medium text-muted-foreground">Clips This Month</p>
              </div>
              <p className="text-3xl font-extrabold text-brand-gold">
                {clipsUsed}
                <span className="text-sm font-normal text-muted-foreground ml-1">/ {limits.clips_per_month ?? "∞"}</span>
              </p>
              {limits.clips_per_month !== null && (
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                  <div
                    className="progress-gradient h-3 transition-all duration-700 ease-out"
                    style={{ width: `${Math.min((clipsUsed / limits.clips_per_month) * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Plan */}
            <div className="space-y-3 p-4 rounded-xl bg-white/80 border border-brand-lavender/10">
              <div className="flex items-center gap-2">
                <span className="text-xl">⭐</span>
                <p className="text-sm font-medium text-muted-foreground">Your Plan</p>
              </div>
              <p className="text-3xl font-extrabold capitalize bg-gradient-to-r from-brand-green to-brand-gold bg-clip-text text-transparent">
                {plan}
              </p>
              {plan !== "premium" && (
                <Link href="/pricing" className="inline-flex items-center gap-1 text-sm text-brand-coral font-semibold hover:underline">
                  🚀 Upgrade plan
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ⚠️ Voice limit upsell */}
        {atVoiceLimit && plan !== "premium" && (
          <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-brand-cream p-5 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="text-3xl">🌱</span>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-amber-900">Time to grow your voice garden! 🌻</p>
                <p className="text-sm text-amber-700">
                  {plan === "free"
                    ? "You've used your 1 free voice. Upgrade to Family for 2 voices, or Premium for unlimited!"
                    : "You've used both Family voices. Upgrade to Premium for unlimited voice profiles!"}
                </p>
              </div>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-amber-500 to-brand-gold px-5 text-sm font-bold text-white hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              ✨ Upgrade
            </Link>
          </div>
        )}

        {/* 🎙️ Family Voices */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎙️</span>
              <div>
                <h2 className="text-2xl font-bold">Your Family Voices</h2>
                {limits.voice_slots !== null && (
                  <p className="text-xs text-muted-foreground">
                    {voiceSlotsUsed} / {limits.voice_slots} voice profile{limits.voice_slots === 1 ? "" : "s"} used
                  </p>
                )}
              </div>
            </div>
            {atVoiceLimit && plan !== "premium" ? (
              <Link
                href="/pricing"
                className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-brand-gold to-brand-coral px-5 text-sm font-bold text-white hover:shadow-lg hover:scale-105 transition-all duration-300"
              >
                Upgrade to Add More
              </Link>
            ) : (
              <Link
                href="/onboarding"
                className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-brand-green to-brand-green/80 px-5 text-sm font-bold text-white shadow-md shadow-brand-green/20 hover:shadow-lg hover:scale-105 transition-all duration-300"
              >
                ➕ Add Voice
              </Link>
            )}
          </div>
          <FamilyVoicesList initialVoices={voices || []} />
        </section>

        {/* 🎬 Recent Clips / Family Library */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📚</span>
              <div>
                <h2 className="text-2xl font-bold">Your Family Library</h2>
                <p className="text-muted-foreground text-sm">Recent videos and ongoing projects</p>
              </div>
            </div>
            <Link
              href="/create"
              className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-brand-green to-brand-green/80 px-5 text-sm font-bold text-white shadow-md shadow-brand-green/20 hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              🎬 New Project
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentClips && recentClips.length > 0 ? (
              recentClips.map((clip) => {
                const content = clip.content_library as Record<string, unknown> | null;
                return (
                  <div
                    key={clip.id}
                    className="card-hover-lift rounded-2xl border-2 border-border/60 overflow-hidden bg-white shadow-md hover:shadow-xl"
                  >
                    <div className="aspect-video bg-gradient-to-br from-brand-sage/20 to-brand-sky/10 flex items-center justify-center">
                      {content?.thumbnail_url ? (
                        <img src={content.thumbnail_url as string} alt={content?.title as string} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl">🎬</span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-bold truncate">{(content?.title as string) ?? "Untitled"}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <span>🎤</span> {(clip.family_voices as Record<string, unknown>)?.name as string ?? "Unknown"}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 col-span-full rounded-2xl border-2 border-dashed border-brand-sage/40 bg-gradient-to-br from-brand-cream/30 to-white">
                <div className="text-6xl mb-4">🎬</div>
                <h3 className="text-xl font-bold mb-2">No videos yet!</h3>
                <p className="text-muted-foreground mb-6">Create your first magical family video ✨</p>
                <Link
                  href="/create"
                  className="inline-flex h-12 items-center rounded-2xl bg-gradient-to-r from-brand-green to-brand-green/80 px-8 text-base font-bold text-white shadow-lg shadow-brand-green/20 hover:shadow-xl hover:scale-105 transition-all duration-300"
                >
                  🌟 Create Your First Video
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* 🔍 Discover CTA — gradient banner */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-green via-brand-green/90 to-brand-sage p-8 sm:p-10 text-center text-white shadow-xl">
          {/* Decorative floating elements */}
          <div className="absolute top-3 left-8 text-2xl float-element opacity-40 select-none">📖</div>
          <div className="absolute bottom-4 right-10 text-xl float-element-reverse opacity-30 select-none">🌟</div>
          <div className="absolute top-1/2 right-[20%] text-lg sparkle-element opacity-25 select-none hidden sm:block">✨</div>

          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
              Discover Amazing Stories! 📚
            </h2>
            <p className="text-white/80 text-lg mb-6 max-w-xl mx-auto">
              Explore our library of children&apos;s educational videos and hear them in your family&apos;s voice!
            </p>
            <Link
              href="/browse"
              className="inline-flex h-12 items-center rounded-2xl bg-white px-8 text-base font-bold text-brand-green shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              🔍 Browse Content
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
