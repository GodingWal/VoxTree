import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import { ContentActions, AddContentButton } from "./content-actions";
import { BookOpen, Video } from "lucide-react";

export default async function AdminContentPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const admin = await isAdmin(user.email);
  if (!admin) redirect("/dashboard");

  const adminClient = createAdminClient();

  const { data: content } = await adminClient
    .from("content_library")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-brand-charcoal dark:text-foreground">
            Content Library
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage stories and educational videos
          </p>
        </div>
        <AddContentButton />
      </div>

      <div className="rounded-xl border bg-white dark:bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="px-6 py-4 font-medium">Title & Art</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Details</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {content?.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      {c.thumbnail_url ? (
                        <div className="relative h-12 w-20 rounded bg-muted overflow-hidden shrink-0">
                          <Image
                            src={c.thumbnail_url}
                            alt={c.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-20 items-center justify-center rounded bg-muted shrink-0">
                          {c.content_type === "story" ? (
                            <BookOpen className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <Video className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-brand-charcoal dark:text-foreground">
                          {c.title}
                        </div>
                        {c.series && (
                          <div className="text-xs text-muted-foreground">
                            {c.series} {c.episode_number ? `Ep ${c.episode_number}` : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      <span className="capitalize inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                        {c.content_type}
                      </span>
                      {c.is_premium && (
                        <span className="inline-flex items-center rounded-full bg-brand-gold/20 text-brand-gold px-2.5 py-0.5 text-xs font-medium">
                          Premium
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs space-y-1">
                      {c.duration_seconds && (
                        <div><span className="text-muted-foreground">Duration:</span> {Math.ceil(c.duration_seconds/60)}m</div>
                      )}
                      {c.age_range && (
                        <div><span className="text-muted-foreground">Ages:</span> {c.age_range}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ContentActions contentId={c.id} />
                  </td>
                </tr>
              ))}
              {(!content || content.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No content found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
