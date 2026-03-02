import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS } from "@/lib/limits";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import Link from "next/link";

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

  return (
    <div className="min-h-screen bg-background">
      <Nav plan={plan} />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-secondary py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-primary mb-6">
              Create Magical
              <br />
              Family Videos
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Transform your family memories with AI-powered voice cloning, collaborative editing, and stunning video creation tools designed for families.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/create" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground hover:bg-primary/90">
                Start Creating
              </Link>
              <Link href="/stories" className="inline-flex h-12 items-center justify-center rounded-md bg-secondary px-6 text-base font-medium hover:bg-secondary/80">
                Browse Stories
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute top-20 right-10 w-32 h-32 bg-primary/20 rounded-full blur-xl hidden sm:block" />
        <div className="absolute bottom-20 left-10 w-24 h-24 bg-accent/20 rounded-full blur-xl hidden sm:block" />
      </section>

      {/* Quick Actions */}
      <section className="py-12 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { icon: "🎤", title: "Record Voice", desc: "Capture family voices for AI cloning", href: "/voice-cloning", color: "bg-primary/20" },
              { icon: "🤖", title: "AI Clone", desc: "Create AI voice duplicates instantly", href: "/voice-cloning", color: "bg-accent/20" },
              { icon: "🎬", title: "Create Video", desc: "Generate family stories with AI", href: "/create", color: "bg-primary/20" },
              { icon: "👥", title: "Collaborate", desc: "Work together in real-time", href: "/videos", color: "bg-accent/20" },
            ].map((action) => (
              <Link key={action.title} href={action.href} className="rounded-xl border p-6 hover:shadow-lg transition-all hover:border-primary/50 group">
                <div className={`w-12 h-12 ${action.color} rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <span className="text-xl">{action.icon}</span>
                </div>
                <h3 className="font-semibold mb-1">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Usage Summary */}
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Usage Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Voice Profiles</p>
              <p className="text-2xl font-bold">{voiceSlotsUsed} <span className="text-sm font-normal text-muted-foreground">/ {limits.voice_slots ?? "∞"}</span></p>
              {limits.voice_slots !== null && (
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min((voiceSlotsUsed / limits.voice_slots) * 100, 100)}%` }} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Clips This Month</p>
              <p className="text-2xl font-bold">{clipsUsed} <span className="text-sm font-normal text-muted-foreground">/ {limits.clips_per_month ?? "∞"}</span></p>
              {limits.clips_per_month !== null && (
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min((clipsUsed / limits.clips_per_month) * 100, 100)}%` }} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="text-2xl font-bold capitalize">{plan}</p>
              {plan !== "premium" && (
                <Link href="/pricing" className="text-sm text-primary hover:underline">Upgrade plan</Link>
              )}
            </div>
          </div>
        </section>

        {/* Voice limit upsell */}
        {atVoiceLimit && plan !== "premium" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-amber-900">Voice profile limit reached</p>
              <p className="text-sm text-amber-700">
                {plan === "free"
                  ? "You've used your 1 free voice profile. Upgrade to Family for 2 profiles, or Premium for unlimited."
                  : "You've used both Family voice profiles. Upgrade to Premium for unlimited voice profiles."}
              </p>
            </div>
            <Link href="/pricing" className="shrink-0 inline-flex h-9 items-center rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700">
              Upgrade
            </Link>
          </div>
        )}

        {/* Family Voices */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Your Family Voices</h2>
            {atVoiceLimit && plan !== "premium" ? (
              <Link href="/pricing" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Upgrade to Add More</Link>
            ) : (
              <Link href="/onboarding" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Add Voice</Link>
            )}
          </div>
          {limits.voice_slots !== null && (
            <p className="text-xs text-muted-foreground">{voiceSlotsUsed} / {limits.voice_slots} voice profile{limits.voice_slots === 1 ? "" : "s"} used</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {voices && voices.length > 0 ? voices.map((voice) => (
              <div key={voice.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{voice.name}</h3>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${voice.status === "ready" ? "bg-green-100 text-green-700" : voice.status === "processing" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                    {voice.status}
                  </span>
                </div>
              </div>
            )) : (
              <p className="text-muted-foreground col-span-full">No voices yet. Add a family member&apos;s voice to get started.</p>
            )}
          </div>
        </section>

        {/* Recent Clips */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Your Family Library</h2>
              <p className="text-muted-foreground text-sm">Recent videos and ongoing projects</p>
            </div>
            <Link href="/create" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              New Project
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentClips && recentClips.length > 0 ? recentClips.map((clip) => {
              const content = clip.content_library as Record<string, unknown> | null;
              return (
                <div key={clip.id} className="rounded-lg border overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    {content?.thumbnail_url ? (
                      <img src={content.thumbnail_url as string} alt={content?.title as string} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl text-muted-foreground">🎬</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">{content?.title as string ?? "Untitled"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Voice: {(clip.family_voices as Record<string, unknown>)?.name as string ?? "Unknown"}</p>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-12 col-span-full">
                <span className="text-4xl block mb-4">🎬</span>
                <h3 className="text-lg font-semibold mb-2">No videos yet</h3>
                <p className="text-muted-foreground mb-4">Start creating your first family video</p>
                <Link href="/create" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Create Your First Video</Link>
              </div>
            )}
          </div>
        </section>

        {/* Browse CTA */}
        <section className="rounded-lg border bg-card p-6 text-center space-y-3">
          <h2 className="text-xl font-semibold">Discover Educational Content</h2>
          <p className="text-muted-foreground">Browse our library of children&apos;s educational videos and hear them in your family&apos;s voice.</p>
          <Link href="/browse" className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Browse Content
          </Link>
        </section>
      </main>
    </div>
  );
}
