import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserActions } from "./user-actions";

export default async function AdminUsersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const admin = await isAdmin(user.email);
  if (!admin) redirect("/dashboard");

  const adminClient = createAdminClient();

  // Fetch all users from public.users
  const { data: publicUsers } = await adminClient
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch auth users to get emails (requires service role)
  const {
    data: { users: authUsers },
  } = await adminClient.auth.admin.listUsers();

  // Merge the data
  const users = publicUsers?.map((pu) => {
    const authUser = authUsers.find((au) => au.id === pu.id);
    return {
      ...pu,
      email: authUser?.email ?? "Unknown",
    };
  }) ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-brand-charcoal dark:text-foreground">
          User Management
        </h2>
        <span className="text-sm text-muted-foreground">
          Total Users: {users.length}
        </span>
      </div>

      <div className="rounded-xl border bg-white dark:bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Plan</th>
                <th className="px-6 py-4 font-medium">Usage</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-brand-charcoal dark:text-foreground">
                      {u.name || "No Name"}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.plan === 'premium' ? 'bg-brand-gold/20 text-brand-gold' :
                      u.plan === 'family' ? 'bg-brand-coral/20 text-brand-coral' :
                      'bg-brand-sage/20 text-brand-green'
                    }`}>
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs space-y-1">
                      <div><span className="text-muted-foreground">Voices:</span> {u.voice_slots_used}</div>
                      <div><span className="text-muted-foreground">Clips:</span> {u.videos_used}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <UserActions userId={u.id} userEmail={u.email} />
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No users found.
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
