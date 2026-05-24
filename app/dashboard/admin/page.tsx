import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Section } from "@/components/twilight-ui";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = await isAdmin(user.email);
  if (!admin) redirect("/");

  // Fetch aggregate stats
  const { count: userCount } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  const { count: voiceCount } = await supabase
    .from("family_voices")
    .select("*", { count: "exact", head: true });

  const { count: contentCount } = await supabase
    .from("content_library")
    .select("*", { count: "exact", head: true });

  const { count: clipCount } = await supabase
    .from("generated_clips")
    .select("*", { count: "exact", head: true });

  const stats = [
    { label: "Total Users", value: userCount ?? 0, color: "var(--moss)" },
    { label: "Voice Clones", value: voiceCount ?? 0, color: "var(--rose)" },
    { label: "Content Items", value: contentCount ?? 0, color: "var(--lamp)" },
    { label: "Generated Clips", value: clipCount ?? 0, color: "var(--plum)" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56 }}>
      <Section eyebrow="Metrics" title={<>System <span className="serif-italic">Overview</span></>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "var(--ink-2)", border: "1px solid var(--ink-3)",
                borderRadius: 20, padding: 24,
                display: "flex", flexDirection: "column", gap: 12
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: 99, background: stat.color }} />
              <div>
                <div className="serif" style={{ fontSize: 36, color: "var(--paper)", lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", marginTop: 8 }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Shortcuts" title={<>Quick <span className="serif-italic">Actions</span></>}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 600 }}>
          <Link href="/dashboard/admin/content" style={{
            background: "var(--ink-2)", border: "1px solid var(--ink-3)",
            borderRadius: 20, padding: 24, textDecoration: "none",
            display: "flex", flexDirection: "column", gap: 12
          }}>
            <div style={{ color: "var(--lamp)", fontSize: 24 }}>📚</div>
            <div>
              <div style={{ fontSize: 16, color: "var(--paper)", fontWeight: 500 }}>Manage Content</div>
              <div style={{ fontSize: 13, color: "var(--paper-dim)", marginTop: 4 }}>Add, edit, or remove stories</div>
            </div>
          </Link>

          <Link href="/dashboard/admin/users" style={{
            background: "var(--ink-2)", border: "1px solid var(--ink-3)",
            borderRadius: 20, padding: 24, textDecoration: "none",
            display: "flex", flexDirection: "column", gap: 12
          }}>
            <div style={{ color: "var(--plum)", fontSize: 24 }}>👥</div>
            <div>
              <div style={{ fontSize: 16, color: "var(--paper)", fontWeight: 500 }}>Manage Users</div>
              <div style={{ fontSize: 13, color: "var(--paper-dim)", marginTop: 4 }}>View users and subscriptions</div>
            </div>
          </Link>
        </div>
      </Section>
    </div>
  );
}
