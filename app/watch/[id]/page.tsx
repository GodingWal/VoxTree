import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StoryPlayer } from "@/components/story-player";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { BrandLogo } from "@/components/brand-logo";

interface WatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: content } = await supabase
    .from("content_library")
    .select("*")
    .eq("id", id)
    .single();

  if (!content) {
    redirect("/browse");
  }

  const { data: voices } = await supabase
    .from("family_voices")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  // Check if there's already a generated clip for this content
  const { data: existingClips } = await supabase
    .from("generated_clips")
    .select("*, family_voices(name)")
    .eq("user_id", user.id)
    .eq("content_id", id)
    .in("status", ["ready", "queued", "processing"])
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-brand-cream/40 dark:bg-background">
      <header className="border-b bg-white/80 dark:bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/browse"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Browse</span>
            </Link>
            <div className="h-5 w-px bg-border hidden sm:block" />
            <BrandLogo href="/dashboard" hideTextOnMobile />
          </div>
          <DarkModeToggle />
        </div>
      </header>

      <main className="container max-w-3xl py-8 sm:py-12">
        <StoryPlayer
          content={content}
          voices={voices ?? []}
          existingClips={existingClips ?? []}
        />
      </main>
    </div>
  );
}
