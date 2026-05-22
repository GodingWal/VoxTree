import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Play, Mic, Users, BookOpen } from "lucide-react";

export default async function AdminAnalyticsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const admin = await isAdmin(user.email);
  if (!admin) redirect("/dashboard");

  const adminClient = createAdminClient();

  // Basic counts
  const { count: userCount } = await adminClient.from("users").select("*", { count: "exact", head: true });
  const { count: premiumUserCount } = await adminClient.from("users").select("*", { count: "exact", head: true }).eq("plan", "premium");
  const { count: voiceCount } = await adminClient.from("family_voices").select("*", { count: "exact", head: true });
  const { count: clipCount } = await adminClient.from("generated_clips").select("*", { count: "exact", head: true });
  const { count: contentCount } = await adminClient.from("content_library").select("*", { count: "exact", head: true });

  // Most active users (by clips generated)
  // Since we don't have a direct aggregate query easily without RPC, we'll fetch clips and group in memory for this simple dashboard
  const { data: clips } = await adminClient.from("generated_clips").select("user_id, content_id");
  const userClipCounts = (clips || []).reduce((acc: Record<string, number>, clip) => {
    acc[clip.user_id] = (acc[clip.user_id] || 0) + 1;
    return acc;
  }, {});
  const topUserIds = Object.entries(userClipCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id);
  
  const { data: topUsersData } = topUserIds.length > 0 
    ? await adminClient.from("users").select("id, name, email").in("id", topUserIds)
    : { data: [] };

  // Popular Content
  const contentCounts = (clips || []).reduce((acc: Record<string, number>, clip) => {
    acc[clip.content_id] = (acc[clip.content_id] || 0) + 1;
    return acc;
  }, {});
  const topContentIds = Object.entries(contentCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id);

  const { data: topContentData } = topContentIds.length > 0
    ? await adminClient.from("content_library").select("id, title, content_type").in("id", topContentIds)
    : { data: [] };

  // Sort them to match the counts
  const topUsers = topUsersData?.map(u => ({ ...u, count: userClipCounts[u.id] })).sort((a, b) => b.count - a.count) || [];
  const topContent = topContentData?.map(c => ({ ...c, count: contentCounts[c.id] })).sort((a, b) => b.count - a.count) || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-xl font-semibold text-brand-charcoal dark:text-foreground">
          Platform Analytics
        </h2>
        <p className="text-sm text-muted-foreground">
          Key Performance Indicators and Usage Stats
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white dark:bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Users className="h-4 w-4" />
            <h3 className="text-sm font-medium">Total Users</h3>
          </div>
          <p className="text-2xl font-bold">{userCount || 0}</p>
          <p className="text-xs text-brand-green mt-1">{premiumUserCount || 0} Premium</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Mic className="h-4 w-4" />
            <h3 className="text-sm font-medium">Voice Clones</h3>
          </div>
          <p className="text-2xl font-bold">{voiceCount || 0}</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Play className="h-4 w-4" />
            <h3 className="text-sm font-medium">Clips Generated</h3>
          </div>
          <p className="text-2xl font-bold">{clipCount || 0}</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <BookOpen className="h-4 w-4" />
            <h3 className="text-sm font-medium">Content Items</h3>
          </div>
          <p className="text-2xl font-bold">{contentCount || 0}</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Top Content */}
        <div className="rounded-xl border bg-white dark:bg-card shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Most Popular Content</h3>
          <div className="space-y-4">
            {topContent.map((c, i) => (
              <div key={c.id} className="flex items-center gap-4">
                <div className="w-6 text-center font-bold text-muted-foreground">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">{c.content_type}</p>
                </div>
                <div className="text-sm font-semibold">{c.count} clips</div>
              </div>
            ))}
            {topContent.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
            )}
          </div>
        </div>

        {/* Top Users */}
        <div className="rounded-xl border bg-white dark:bg-card shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Most Active Users</h3>
          <div className="space-y-4">
            {topUsers.map((u, i) => (
              <div key={u.id} className="flex items-center gap-4">
                <div className="w-6 text-center font-bold text-muted-foreground">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="text-sm font-semibold">{u.count} clips</div>
              </div>
            ))}
             {topUsers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
