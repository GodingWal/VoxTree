import { requireAdmin, getAdminClient } from "@/lib/auth";
import { AdminNav } from "@/components/nav";
import Link from "next/link";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const supabase = getAdminClient();

  const [usersRes, contentRes, clipsRes, voicesRes] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("content_library").select("*", { count: "exact", head: true }),
    supabase.from("generated_clips").select("*", { count: "exact", head: true }),
    supabase.from("family_voices").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Total Users", value: usersRes.count ?? 0, href: "/admin/users", color: "border-t-blue-500", icon: "👥" },
    { label: "Content Items", value: contentRes.count ?? 0, href: "/admin/content", color: "border-t-green-500", icon: "📚" },
    { label: "Generated Clips", value: clipsRes.count ?? 0, href: "#", color: "border-t-purple-500", icon: "🎬" },
    { label: "Voice Profiles", value: voicesRes.count ?? 0, href: "#", color: "border-t-amber-500", icon: "🎤" },
  ];

  // Recent signups
  const { data: recentUsers } = await supabase
    .from("users")
    .select("id, name, email, plan, role, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  // Recent voice profiles
  const { data: recentVoices } = await supabase
    .from("family_voices")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  // Recent clips
  const { data: recentClips } = await supabase
    .from("generated_clips")
    .select("id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  // Voice job stats
  const { data: readyVoices } = await supabase
    .from("family_voices")
    .select("*", { count: "exact", head: true })
    .eq("status", "ready");

  const { data: processingVoices } = await supabase
    .from("family_voices")
    .select("*", { count: "exact", head: true })
    .eq("status", "processing");

  const { data: failedVoices } = await supabase
    .from("family_voices")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed");

  const totalVoices = voicesRes.count ?? 0;
  const readyCount = readyVoices?.count ?? 0;
  const processingCount = processingVoices?.count ?? 0;
  const failedCount = failedVoices?.count ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />

      <main className="container py-8 space-y-8">
        {/* Header */}
        <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border p-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage VoxTree platform</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className={`rounded-lg border border-t-4 ${stat.color} p-6 space-y-2 hover:shadow-md transition-shadow bg-card`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <span className="text-2xl">{stat.icon}</span>
              </div>
              <p className="text-3xl font-bold">{stat.value}</p>
            </Link>
          ))}
        </div>

        {/* Voice Pipeline Health */}
        <section className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Voice Pipeline Health</h2>
          {totalVoices > 0 ? (
            <>
              <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                {readyCount > 0 && (
                  <div className="bg-green-500 h-full" style={{ width: `${(readyCount / totalVoices) * 100}%` }} />
                )}
                {processingCount > 0 && (
                  <div className="bg-amber-500 h-full" style={{ width: `${(processingCount / totalVoices) * 100}%` }} />
                )}
                {failedCount > 0 && (
                  <div className="bg-red-500 h-full" style={{ width: `${(failedCount / totalVoices) * 100}%` }} />
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-green-500/10 p-3">
                  <p className="text-2xl font-bold text-green-600">{readyCount}</p>
                  <p className="text-xs text-muted-foreground">Ready ({totalVoices > 0 ? Math.round((readyCount / totalVoices) * 100) : 0}%)</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-3">
                  <p className="text-2xl font-bold text-amber-600">{processingCount}</p>
                  <p className="text-xs text-muted-foreground">Processing ({totalVoices > 0 ? Math.round((processingCount / totalVoices) * 100) : 0}%)</p>
                </div>
                <div className="rounded-lg bg-red-500/10 p-3">
                  <p className="text-2xl font-bold text-red-600">{failedCount}</p>
                  <p className="text-xs text-muted-foreground">Failed ({totalVoices > 0 ? Math.round((failedCount / totalVoices) * 100) : 0}%)</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No voice profiles yet.</p>
          )}
        </section>

        {/* Quick Actions */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Link href="/admin/content" className="rounded-lg border p-4 hover:shadow-md transition-shadow bg-card flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center"><span className="text-xl">📚</span></div>
            <div>
              <p className="font-medium">Content Library</p>
              <p className="text-xs text-muted-foreground">Manage videos & stories</p>
            </div>
          </Link>
          <Link href="/admin/users" className="rounded-lg border p-4 hover:shadow-md transition-shadow bg-card flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center"><span className="text-xl">👥</span></div>
            <div>
              <p className="font-medium">User Management</p>
              <p className="text-xs text-muted-foreground">View & manage users</p>
            </div>
          </Link>
          <Link href="/voice-cloning" className="rounded-lg border p-4 hover:shadow-md transition-shadow bg-card flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center"><span className="text-xl">🎤</span></div>
            <div>
              <p className="font-medium">Voice Studio</p>
              <p className="text-xs text-muted-foreground">Create & test voices</p>
            </div>
          </Link>
        </section>

        {/* Three-column recent activity */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Users */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Users</h2>
              <Link href="/admin/users" className="text-sm text-primary hover:underline">View All</Link>
            </div>
            <div className="rounded-lg border divide-y">
              {recentUsers?.slice(0, 5).map((u) => (
                <div key={u.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{u.name ?? u.email ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">{u.plan}</span>
                </div>
              ))}
              {(!recentUsers || recentUsers.length === 0) && (
                <div className="px-4 py-6 text-center text-muted-foreground text-sm">No users yet</div>
              )}
            </div>
          </section>

          {/* Recent Voices */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Recent Voice Profiles</h2>
            <div className="rounded-lg border divide-y">
              {recentVoices?.map((v) => (
                <div key={v.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    v.status === "ready" ? "bg-green-100 text-green-700" :
                    v.status === "processing" ? "bg-amber-100 text-amber-700" :
                    v.status === "failed" ? "bg-red-100 text-red-700" :
                    "bg-muted text-muted-foreground"
                  }`}>{v.status}</span>
                </div>
              ))}
              {(!recentVoices || recentVoices.length === 0) && (
                <div className="px-4 py-6 text-center text-muted-foreground text-sm">No voices yet</div>
              )}
            </div>
          </section>

          {/* Recent Clips */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Recent Generated Clips</h2>
            <div className="rounded-lg border divide-y">
              {recentClips?.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Clip #{c.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.status === "ready" ? "bg-green-100 text-green-700" :
                    c.status === "processing" ? "bg-amber-100 text-amber-700" :
                    c.status === "failed" ? "bg-red-100 text-red-700" :
                    "bg-muted text-muted-foreground"
                  }`}>{c.status}</span>
                </div>
              ))}
              {(!recentClips || recentClips.length === 0) && (
                <div className="px-4 py-6 text-center text-muted-foreground text-sm">No clips yet</div>
              )}
            </div>
          </section>
        </div>

        {/* Full recent users table */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">All Recent Signups</h2>
            <Link href="/admin/users" className="text-sm text-primary hover:underline">View All</Link>
          </div>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers?.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{u.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">{u.plan}</span>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === "admin" ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">admin</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">user</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
