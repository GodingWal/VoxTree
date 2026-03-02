import { requireAdmin, getAdminClient } from "@/lib/auth";
import { AdminNav } from "@/components/nav";

export default async function AdminUsersPage() {
  await requireAdmin();
  const supabase = getAdminClient();

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />

      <main className="container py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            {users?.length ?? 0} total users
          </p>
        </div>

        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Plan</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Voices</th>
                <th className="px-4 py-3 text-left font-medium">Clips/Mo</th>
                <th className="px-4 py-3 text-left font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{u.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === "admin" ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">admin</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">user</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.voice_slots_used}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.clips_used_this_month}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
