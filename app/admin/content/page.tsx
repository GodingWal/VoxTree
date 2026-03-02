import { requireAdmin, getAdminClient } from "@/lib/auth";
import { AdminNav } from "@/components/nav";
import Link from "next/link";

export default async function AdminContentPage() {
  await requireAdmin();
  const supabase = getAdminClient();

  const { data: content } = await supabase
    .from("content_library")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />

      <main className="container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Content Library</h1>
            <p className="text-muted-foreground">Manage videos and stories in the content library.</p>
          </div>
          <Link
            href="/admin/content/new"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Content
          </Link>
        </div>

        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Series</th>
                <th className="px-4 py-3 text-left font-medium">Premium</th>
                <th className="px-4 py-3 text-left font-medium">Age Range</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {content?.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{item.title}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                      {item.content_type ?? "video"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.series ?? "—"}</td>
                  <td className="px-4 py-3">
                    {item.is_premium ? (
                      <span className="rounded-full bg-brand-gold/10 px-2 py-0.5 text-xs font-medium text-brand-gold">Yes</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.age_range ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}

              {(!content || content.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No content yet. Add your first video or story.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
