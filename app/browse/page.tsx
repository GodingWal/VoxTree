import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, BookOpen, Play, Sparkles, Clock } from "lucide-react";
import { DarkModeToggle } from "@/components/dark-mode-toggle";

export default async function BrowsePage() {
  const supabase = createClient();

  const { data: content } = await supabase
    .from("content_library")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-brand-cream/40 dark:bg-background">
      <header className="border-b bg-white/80 dark:bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <div className="h-5 w-px bg-border hidden sm:block" />
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-brand-green flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold text-brand-charcoal dark:text-foreground hidden sm:block">
                VoxTree
              </span>
            </Link>
          </div>
          <DarkModeToggle />
        </div>
      </header>

      <main className="container py-8 sm:py-12 space-y-8">
        <div className="space-y-2 text-center sm:text-left">
          <h1 className="text-3xl font-bold text-brand-charcoal dark:text-foreground">
            Stories & Content
          </h1>
          <p className="text-muted-foreground max-w-lg">
            Pick a story and hear it narrated in your family&apos;s voice. Just tap to listen.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {content?.map((item) => (
            <Link
              key={item.id}
              href={`/watch/${item.id}`}
              className="group rounded-2xl bg-white dark:bg-card border overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              {/* Thumbnail */}
              <div className="aspect-[16/10] bg-gradient-to-br from-brand-sage/30 to-brand-green/10 relative overflow-hidden">
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BookOpen className="h-12 w-12 text-brand-green/25" />
                  </div>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                  <div className="h-14 w-14 rounded-full bg-white/90 dark:bg-white/95 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
                    <Play className="h-6 w-6 text-brand-green ml-0.5" />
                  </div>
                </div>

                {/* Badges */}
                <div className="absolute top-3 right-3 flex gap-2">
                  {item.is_premium && (
                    <span className="rounded-full bg-brand-gold px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                      Premium
                    </span>
                  )}
                </div>

                {item.duration_seconds && (
                  <div className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.ceil(item.duration_seconds / 60)} min
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-brand-charcoal dark:text-foreground group-hover:text-brand-green transition-colors truncate">
                  {item.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.series && (
                    <span>
                      {item.series}
                      {item.episode_number != null && ` · Ep. ${item.episode_number}`}
                    </span>
                  )}
                  {item.age_range && (
                    <span className="inline-flex items-center rounded-full bg-brand-sage/20 px-2 py-0.5 text-xs font-medium text-brand-green">
                      Ages {item.age_range}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}

          {(!content || content.length === 0) && (
            <div className="col-span-full rounded-2xl border-2 border-dashed border-muted p-12 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-sage/20 flex items-center justify-center mb-4">
                <BookOpen className="h-7 w-7 text-brand-green/50" />
              </div>
              <p className="text-sm font-medium text-brand-charcoal dark:text-foreground">
                No stories yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                New content is being added all the time. Check back soon!
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
