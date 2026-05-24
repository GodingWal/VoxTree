import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserActions } from "./user-actions";
import { Section } from "@/components/twilight-ui";

export default async function AdminUsersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const admin = await isAdmin(user.email);
  if (!admin) redirect("/");

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
    <Section eyebrow="Management" title={<>All <span className="serif-italic">Users</span> ({users.length})</>}>
      <div style={{
        background: "var(--ink-1)", border: "1px solid var(--ink-3)",
        borderRadius: 20, overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "rgba(244,236,219,0.03)", borderBottom: "1px solid var(--ink-3)" }}>
                <th className="mono" style={{ padding: "16px 24px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", fontWeight: 400 }}>User</th>
                <th className="mono" style={{ padding: "16px 24px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", fontWeight: 400 }}>Plan</th>
                <th className="mono" style={{ padding: "16px 24px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", fontWeight: 400 }}>Usage</th>
                <th className="mono" style={{ padding: "16px 24px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", fontWeight: 400, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--ink-3)" }}>
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{ color: "var(--paper)", fontWeight: 500, fontSize: 14 }}>
                      {u.name || "No Name"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--paper-dim)", marginTop: 4 }}>{u.email}</div>
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <span style={{
                      padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                      background: u.plan === 'premium' ? 'rgba(244,184,96,0.1)' : u.plan === 'family' ? 'rgba(232,133,108,0.1)' : 'rgba(127,196,164,0.1)',
                      color: u.plan === 'premium' ? 'var(--lamp-soft)' : u.plan === 'family' ? 'var(--coral)' : 'var(--moss)'
                    }}>
                      {u.plan}
                    </span>
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{ fontSize: 12, color: "var(--paper)", display: "flex", flexDirection: "column", gap: 4 }}>
                      <div><span style={{ color: "var(--paper-mute)" }}>Voices:</span> {u.voice_slots_used}</div>
                      <div><span style={{ color: "var(--paper-mute)" }}>Clips:</span> {u.videos_used}</div>
                    </div>
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "right" }}>
                    <UserActions userId={u.id} userEmail={u.email} />
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "32px", textAlign: "center", color: "var(--paper-mute)", fontSize: 14 }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}
