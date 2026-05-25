import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import { ContentActions, AddContentButton } from "./content-actions";
import { Section } from "@/components/twilight-ui";

export default async function AdminContentPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const admin = await isAdmin(user.email);
  if (!admin) redirect("/");

  const adminClient = createAdminClient();

  const { data: content } = await adminClient
    .from("content_library")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <Section eyebrow="Library" title={<>All <span className="serif-italic">Content</span></>}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <AddContentButton />
      </div>
      <div style={{
        background: "var(--ink-1)", border: "1px solid var(--ink-3)",
        borderRadius: 20, overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "rgba(244,236,219,0.03)", borderBottom: "1px solid var(--ink-3)" }}>
                <th className="mono" style={{ padding: "16px 24px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", fontWeight: 400 }}>Title & Art</th>
                <th className="mono" style={{ padding: "16px 24px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", fontWeight: 400 }}>Type</th>
                <th className="mono" style={{ padding: "16px 24px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", fontWeight: 400 }}>Details</th>
                <th className="mono" style={{ padding: "16px 24px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", fontWeight: 400, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {content?.map((c, i) => (
                <tr key={c.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--ink-3)" }}>
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {c.thumbnail_url ? (
                        <div style={{ position: "relative", width: 80, height: 48, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "var(--ink-2)" }}>
                          <Image src={c.thumbnail_url} alt={c.title} fill style={{ objectFit: "cover" }} />
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 80, height: 48, borderRadius: 8, background: "var(--ink-2)", flexShrink: 0, fontSize: 20 }}>
                          {c.content_type === "story" ? "📚" : "🎬"}
                        </div>
                      )}
                      <div>
                        <div style={{ color: "var(--paper)", fontWeight: 500, fontSize: 14 }}>
                          {c.title}
                        </div>
                        {c.series && (
                          <div style={{ fontSize: 12, color: "var(--paper-dim)", marginTop: 4 }}>
                            {c.series} {c.episode_number ? `Ep ${c.episode_number}` : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, textTransform: "capitalize",
                        background: "var(--ink-2)", color: "var(--paper-dim)"
                      }}>
                        {c.content_type}
                      </span>
                      {c.is_premium && (
                        <span style={{
                          padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                          background: "rgba(244,184,96,0.1)", color: "var(--lamp-soft)"
                        }}>
                          Premium
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{ fontSize: 12, color: "var(--paper)", display: "flex", flexDirection: "column", gap: 4 }}>
                      {c.duration_seconds && (
                        <div><span style={{ color: "var(--paper-mute)" }}>Duration:</span> {Math.ceil(c.duration_seconds/60)}m</div>
                      )}
                      {c.age_range && (
                        <div><span style={{ color: "var(--paper-mute)" }}>Ages:</span> {c.age_range}</div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "right" }}>
                    <ContentActions content={c} />
                  </td>
                </tr>
              ))}
              {(!content || content.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ padding: "32px", textAlign: "center", color: "var(--paper-mute)", fontSize: 14 }}>
                    No content found.
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
