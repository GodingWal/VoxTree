import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { StoriesPlayer } from "@/components/stories-player";

export default async function StoriesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all stories from the content library
  const { data: stories } = await supabase
    .from("content_library")
    .select("*")
    .order("series", { ascending: true })
    .order("episode_number", { ascending: true });

  // Fetch user's ready voice clones
  const { data: voices } = await supabase
    .from("family_voices")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  // Fetch any existing generated clips for this user
  const { data: existingClips } = await supabase
    .from("generated_clips")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ready");

  return (
    <main className="container max-w-3xl py-8 sm:py-12 space-y-6">
      <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-green/10 p-2.5">
            <BookOpen className="h-5 w-5 text-brand-green" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-brand-charcoal dark:text-foreground">
              Stories
            </h1>
            <p className="text-sm text-muted-foreground">
              Listen to stories narrated by your family&apos;s voice — even with the screen off.
            </p>
          </div>
        </div>
      </div>

      <StoriesPlayer
        stories={stories ?? []}
        voices={voices ?? []}
        existingClips={existingClips ?? []}
      />
    </main>
  );
}
