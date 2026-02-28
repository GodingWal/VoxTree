import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS } from "@/lib/limits";
import { redirect } from "next/navigation";
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-xl font-bold text-brand-green">VoxTree</h1>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
              {planLabel}
            </span>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        {/* Voice limit upsell banner */}
        {atVoiceLimit && plan !== "premium" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-amber-900">
                Voice profile limit reached
              </p>
              <p className="text-sm text-amber-700">
                {plan === "free"
                  ? "You've used your 1 free voice profile. Upgrade to Family for 2 profiles, or Premium for unlimited."
                  : "You've used both Family voice profiles. Upgrade to Premium for unlimited voice profiles."}
              </p>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 inline-flex h-9 items-center rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700"
            >
              Upgrade
            </Link>
          </div>
        )}

        {/* Family Voices */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Your Family Voices</h2>
            {atVoiceLimit && plan !== "premium" ? (
              <Link
                href="/pricing"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Upgrade to Add More
              </Link>
            ) : (
              <Link
                href="/onboarding"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Add Voice
              </Link>
            )}
          </div>

          {limits.voice_slots !== null && (
            <p className="text-xs text-muted-foreground">
              {voiceSlotsUsed} / {limits.voice_slots} voice profile
              {limits.voice_slots === 1 ? "" : "s"} used
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {voices && voices.length > 0 ? (
              voices.map((voice) => (
                <div
                  key={voice.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{voice.name}</h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        voice.status === "ready"
                          ? "bg-green-100 text-green-700"
                          : voice.status === "processing"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {voice.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground col-span-full">
                No voices yet. Add a family member&apos;s voice to get started.
              </p>
            )}
          </div>
        </section>

        {/* Recent Clips */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Continue Watching</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentClips && recentClips.length > 0 ? (
              recentClips.map((clip) => (
                <div
                  key={clip.id}
                  className="rounded-lg border overflow-hidden"
                >
                  <div className="aspect-video bg-muted" />
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">
                      {(clip as Record<string, unknown>).content_library
                        ? (
                            (clip as Record<string, unknown>)
                              .content_library as Record<string, unknown>
                          ).title as string
                        : "Untitled"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground col-span-full">
                No clips yet. Browse content to create your first personalized
                video.
              </p>
            )}
          </div>
        </section>

        {/* Browse CTA */}
        <section className="rounded-lg border bg-card p-6 text-center space-y-3">
          <h2 className="text-xl font-semibold">
            Discover Educational Content
          </h2>
          <p className="text-muted-foreground">
            Browse our library of children&apos;s educational videos and hear
            them in your family&apos;s voice.
          </p>
          <Link
            href="/browse"
            className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Browse Content
          </Link>
        </section>
      </main>
    </div>
  );
}
