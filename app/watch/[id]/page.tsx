import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import Link from "next/link";

interface WatchPageProps {
  params: { id: string };
}

export default async function WatchPage({ params }: WatchPageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: content } = await supabase
    .from("content_library")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!content) {
    redirect("/browse");
  }

  const { data: voices } = await supabase
    .from("family_voices")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ready");

  const { data: existingClips } = await supabase
    .from("generated_clips")
    .select("*")
    .eq("content_id", params.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-background">
      <Nav showBack />

      <main className="container py-8 space-y-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Video player area */}
          <div className="lg:col-span-2 space-y-4">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
              {content.thumbnail_url ? (
                <img
                  src={content.thumbnail_url}
                  alt={content.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  Video Preview
                </div>
              )}
              {content.is_premium && (
                <span className="absolute top-3 right-3 rounded-full bg-brand-gold px-3 py-1 text-xs font-bold text-white">
                  Premium
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{content.title}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {content.series && (
                  <span>{content.series}{content.episode_number != null && ` · Ep. ${content.episode_number}`}</span>
                )}
                {content.age_range && <span>Ages {content.age_range}</span>}
                {content.duration_seconds && (
                  <span>{Math.floor(content.duration_seconds / 60)}:{String(content.duration_seconds % 60).padStart(2, "0")}</span>
                )}
              </div>
              {content.description && (
                <p className="text-muted-foreground">{content.description}</p>
              )}
            </div>
          </div>

          {/* Voice selection sidebar */}
          <div className="space-y-6">
            <div className="rounded-lg border p-4 space-y-4">
              <h2 className="text-lg font-semibold">Choose a Voice</h2>
              <p className="text-sm text-muted-foreground">
                Select a family voice to narrate this content.
              </p>

              {voices && voices.length > 0 ? (
                <div className="space-y-2">
                  {voices.map((voice) => (
                    <VoiceOption
                      key={voice.id}
                      voice={voice}
                      contentId={content.id}
                      existingClip={existingClips?.find((c) => c.voice_id === voice.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No voices yet. Add a family member&apos;s voice to get started.
                  </p>
                  <Link
                    href="/onboarding"
                    className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Add Voice
                  </Link>
                </div>
              )}
            </div>

            {/* Existing clips */}
            {existingClips && existingClips.length > 0 && (
              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="font-medium">Your Generated Clips</h3>
                {existingClips.map((clip) => (
                  <div key={clip.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{clip.voice_id}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        clip.status === "ready"
                          ? "bg-green-100 text-green-700"
                          : clip.status === "processing" || clip.status === "queued"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {clip.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function VoiceOption({
  voice,
  contentId,
  existingClip,
}: {
  voice: { id: string; name: string };
  contentId: string;
  existingClip?: { status: string; output_video_url?: string };
}) {
  const hasReadyClip = existingClip?.status === "ready";

  return (
    <form action="/api/clips/generate" method="POST">
      <input type="hidden" name="contentId" value={contentId} />
      <input type="hidden" name="voiceId" value={voice.id} />
      <button
        type="submit"
        disabled={!!existingClip && existingClip.status !== "failed"}
        className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">{voice.name}</span>
          {hasReadyClip ? (
            <span className="text-xs text-green-600 font-medium">Ready</span>
          ) : existingClip ? (
            <span className="text-xs text-yellow-600 font-medium">{existingClip.status}</span>
          ) : (
            <span className="text-xs text-primary font-medium">Generate</span>
          )}
        </div>
      </button>
    </form>
  );
}
