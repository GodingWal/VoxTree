import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Section } from "@/components/twilight-ui";

export default async function AdminAnalyticsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const admin = await isAdmin(user.email);
  if (!admin) redirect("/");

  const adminClient = createAdminClient();

  // Basic counts
  const { count: userCount } = await adminClient.from("users").select("*", { count: "exact", head: true });
  const { count: premiumUserCount } = await adminClient.from("users").select("*", { count: "exact", head: true }).eq("plan", "premium");
  const { count: voiceCount } = await adminClient.from("family_voices").select("*", { count: "exact", head: true });
  const { count: clipCount } = await adminClient.from("generated_clips").select("*", { count: "exact", head: true });
  const { count: contentCount } = await adminClient.from("content_library").select("*", { count: "exact", head: true });

  // Most active users
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56 }}>
      <Section eyebrow="Overview" title={<>Performance <span className="serif-italic">Metrics</span></>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
          {[
            { label: "Total Users", value: userCount, color: "var(--moss)" },
            { label: "Voice Clones", value: voiceCount, color: "var(--rose)" },
            { label: "Clips Generated", value: clipCount, color: "var(--lamp)" },
            { label: "Content Items", value: contentCount, color: "var(--plum)" }
          ].map((stat, i) => (
            <div key={i} style={{
              background: "var(--ink-2)", border: "1px solid var(--ink-3)",
              borderRadius: 20, padding: 24,
              display: "flex", flexDirection: "column", gap: 12
            }}>
              <div style={{ width: 12, height: 12, borderRadius: 99, background: stat.color }} />
              <div>
                <div className="serif" style={{ fontSize: 36, color: "var(--paper)", lineHeight: 1 }}>
                  {stat.value || 0}
                </div>
                <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", marginTop: 8 }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
        <Section eyebrow="Library" title={<>Most <span className="serif-italic">Popular Content</span></>}>
          <div style={{
            background: "var(--ink-2)", border: "1px solid var(--ink-3)",
            borderRadius: 20, padding: 24,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {topContent.map((c, i) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div className="mono" style={{ fontSize: 14, color: "var(--paper-mute)", width: 24, textAlign: "center" }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: "var(--paper)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.title}
                    </div>
                    <div className="mono" style={{ fontSize: 10, letterSpacing: "0.05em", color: "var(--paper-dim)", textTransform: "capitalize", marginTop: 4 }}>
                      {c.content_type}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--lamp)", fontWeight: 500 }}>
                    {c.count} clips
                  </div>
                </div>
              ))}
              {topContent.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--paper-mute)", textAlign: "center", padding: "20px 0" }}>No data yet</div>
              )}
            </div>
          </div>
        </Section>

        <Section eyebrow="Community" title={<>Most <span className="serif-italic">Active Users</span></>}>
          <div style={{
            background: "var(--ink-2)", border: "1px solid var(--ink-3)",
            borderRadius: 20, padding: 24,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {topUsers.map((u, i) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div className="mono" style={{ fontSize: 14, color: "var(--paper-mute)", width: 24, textAlign: "center" }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: "var(--paper)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.name || "Unnamed"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--paper-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                      {u.email}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--plum)", fontWeight: 500 }}>
                    {u.count} clips
                  </div>
                </div>
              ))}
              {topUsers.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--paper-mute)", textAlign: "center", padding: "20px 0" }}>No data yet</div>
              )}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
