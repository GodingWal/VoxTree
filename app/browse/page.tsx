import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, BookOpen, Play, Clock, Sparkles } from "lucide-react";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { BrandLogo } from "@/components/brand-logo";

// Define the type for our content
type ContentItem = {
  id: string;
  title: string;
  series: string | null;
  episode_number: number | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  age_range: string | null;
  tags: string[];
  is_premium: boolean;
};

export default async function BrowsePage() {
  const supabase = createClient();

  const { data: rawContent } = await supabase
    .from("content_library")
    .select("*")
    .order("created_at", { ascending: false });

  const content = (rawContent ?? []) as ContentItem[];

  // Group content for Netflix-style rows
  // 1. By Series
  const seriesContent = content.filter((c) => c.series !== null);
  const seriesGroups = seriesContent.reduce((acc, curr) => {
    const s = curr.series!;
    if (!acc[s]) acc[s] = [];
    acc[s].push(curr);
    return acc;
  }, {} as Record<string, ContentItem[]>);

  // 2. Standalone Stories (no series)
  const standaloneContent = content.filter((c) => !c.series);

  // 3. New Arrivals (top 5 newest)
  const newArrivals = [...content].slice(0, 5);

  return (
    <div className="min-h-screen bg-brand-cream/40 dark:bg-background">
      <header className="border-b bg-white/80 dark:bg-card/80 backdrop-blur-sm sticky top-0 z-50">
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
            <BrandLogo href="/dashboard" hideTextOnMobile />
          </div>
          <DarkModeToggle />
        </div>
      </header>

      <main className="py-8 sm:py-12 space-y-12">
        <div className="container space-y-2 text-center sm:text-left animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-3xl font-bold text-brand-charcoal dark:text-foreground">
            Library
          </h1>
          <p className="text-muted-foreground max-w-lg">
            Pick a story and hear it narrated in your family&apos;s voice.
          </p>
        </div>

        {content.length === 0 ? (
          <div className="container animate-in fade-in duration-700 delay-150">
            <div className="rounded-2xl border bg-white/50 dark:bg-card/50 p-12 text-center flex flex-col items-center justify-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-brand-sage/20 flex items-center justify-center mb-4">
                <BookOpen className="h-8 w-8 text-brand-green/50" />
              </div>
              <p className="text-lg font-semibold text-brand-charcoal dark:text-foreground">
                Library is expanding
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                New personalized stories and educational content are being added right now. Check back soon!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-10 pb-20">
            {/* Row 1: New Arrivals */}
            {newArrivals.length > 0 && (
              <ContentRow title="New Arrivals" icon={<Sparkles className="h-5 w-5 text-brand-gold" />} items={newArrivals} />
            )}

            {/* Row 2: Standalone Stories */}
            {standaloneContent.length > 0 && (
              <ContentRow title="Short Stories" items={standaloneContent} />
            )}

            {/* Series Rows */}
            {Object.entries(seriesGroups).map(([seriesName, items]) => (
              <ContentRow key={seriesName} title={seriesName} items={items} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// Component for the horizontal carousel
function ContentRow({ title, items, icon }: { title: string, items: ContentItem[], icon?: React.ReactNode }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="container flex items-center gap-2">
        {icon}
        <h2 className="text-xl font-bold text-brand-charcoal dark:text-foreground">{title}</h2>
      </div>
      
      {/* Horizontal Scroller */}
      <div className="w-full overflow-x-auto pb-4 pt-2 px-4 sm:px-8 hide-scrollbar snap-x snap-mandatory">
        <div className="flex gap-4 sm:gap-6 w-max">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/watch/${item.id}`}
              className="group relative w-[280px] sm:w-[320px] shrink-0 snap-start rounded-2xl bg-white dark:bg-card border overflow-hidden shadow-sm hover:shadow-xl hover:shadow-brand-green/10 hover:ring-2 hover:ring-brand-green/50 transition-all duration-300 hover:-translate-y-2 z-0 hover:z-10"
            >
              {/* Thumbnail */}
              <div className="aspect-[16/10] bg-gradient-to-br from-brand-sage/30 to-brand-green/10 relative overflow-hidden">
                {item.thumbnail_url ? (
                  <Image
                    src={item.thumbnail_url}
                    alt={item.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BookOpen className="h-12 w-12 text-brand-green/25" />
                  </div>
                )}

                {/* Animated Pulsing Overlay simulating a live preview on hover */}
                <div className="absolute inset-0 bg-brand-charcoal/0 group-hover:bg-brand-charcoal/20 transition-colors duration-500 flex items-center justify-center">
                  <div className="h-16 w-16 rounded-full bg-white/95 dark:bg-white flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-300 ease-out">
                    <Play className="h-7 w-7 text-brand-green ml-1" />
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
                  <div className="absolute bottom-3 right-3 rounded-md bg-black/70 backdrop-blur-sm px-2 py-1 text-xs text-white font-medium flex items-center gap-1.5 opacity-100 group-hover:opacity-0 transition-opacity">
                    <Clock className="h-3 w-3" />
                    {Math.ceil(item.duration_seconds / 60)} min
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 space-y-1.5 relative bg-white dark:bg-card">
                <h3 className="font-semibold text-brand-charcoal dark:text-foreground group-hover:text-brand-green transition-colors truncate">
                  {item.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.episode_number != null && (
                    <span className="font-medium text-brand-coral">
                      Episode {item.episode_number}
                    </span>
                  )}
                  {item.age_range && (
                    <>
                      {item.episode_number != null && <span>•</span>}
                      <span className="inline-flex items-center rounded-full bg-brand-sage/20 px-2 py-0.5 text-xs font-medium text-brand-green">
                        Ages {item.age_range}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
