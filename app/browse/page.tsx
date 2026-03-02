import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import Link from "next/link";

export default async function BrowsePage() {
  const supabase = createClient();

  const { data: content } = await supabase
    .from("content_library")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <main className="container py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Browse Content</h1>
          <p className="text-muted-foreground">
            Choose a video and hear it in your family&apos;s voice.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {content?.map((item) => (
            <Link
              key={item.id}
              href={`/watch/${item.id}`}
              className="group rounded-lg border overflow-hidden transition-shadow hover:shadow-md"
            >
              <div className="aspect-video bg-muted relative">
                {item.thumbnail_url && (
                  <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                )}
                {item.is_premium && (
                  <span className="absolute top-2 right-2 rounded-full bg-brand-gold px-2 py-0.5 text-xs font-bold text-white">
                    Premium
                  </span>
                )}
              </div>
              <div className="p-3 space-y-1">
                <h3 className="font-medium group-hover:text-primary truncate">
                  {item.title}
                </h3>
                {item.series && (
                  <p className="text-xs text-muted-foreground">
                    {item.series}
                    {item.episode_number != null && ` · Ep. ${item.episode_number}`}
                  </p>
                )}
                {item.age_range && (
                  <p className="text-xs text-muted-foreground">
                    Ages {item.age_range}
                  </p>
                )}
              </div>
            </Link>
          ))}

          {(!content || content.length === 0) && (
            <p className="text-muted-foreground col-span-full text-center py-12">
              No content available yet. Check back soon!
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
