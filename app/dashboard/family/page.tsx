import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Section, CloneFullCard } from "@/components/twilight-ui";
import { VoxMark } from "@/components/voxtree-logo";
import { BookOpen, Clock, Users } from "lucide-react";

export default async function FamilyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: voices } = await supabase
    .from("family_voices")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Map supabase voices to Twilight format
  const clones = voices?.map((v, i) => {
    const colors = ["#E8856C", "#F4B860", "#7FC4A4", "#C58FB8"];
    return {
      id: v.id,
      name: v.name,
      relation: "Relative", // Mock or retrieve from DB
      recorded: new Date(v.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      status: v.rvc_training_status === "ready" ? "ready" : (v.rvc_training_status || "ready"),
      lastUsed: "—",
      stories: 0,
      color: colors[i % colors.length]
    };
  }) || [];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 24px" }}>
      <div className="fadeUp" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, gap: 24 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
            Your Family
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0, letterSpacing: "-0.02em", color: "var(--paper)" }}>
            The Family Tree
          </h1>
        </div>
        <Link href="/onboarding" style={{
          padding: "14px 22px",
          background: "var(--lamp)", color: "var(--ink-0)",
          border: 0, borderRadius: 99, textDecoration: "none",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>＋ &nbsp;Invite member</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, marginBottom: 48 }}>
        <div style={{ background: "var(--ink-1)", border: "1px solid var(--ink-3)", borderRadius: 20, padding: 24 }}>
          <Users style={{ color: "var(--rose)", marginBottom: 16 }} />
          <h3 style={{ fontSize: 24, fontWeight: "bold", color: "var(--paper)", margin: 0 }}>{clones.length}</h3>
          <p style={{ fontSize: 14, color: "var(--paper-dim)", margin: 0, marginTop: 4 }}>Family Members</p>
        </div>
        <div style={{ background: "var(--ink-1)", border: "1px solid var(--ink-3)", borderRadius: 20, padding: 24 }}>
          <BookOpen style={{ color: "var(--lamp)", marginBottom: 16 }} />
          <h3 style={{ fontSize: 24, fontWeight: "bold", color: "var(--paper)", margin: 0 }}>0</h3>
          <p style={{ fontSize: 14, color: "var(--paper-dim)", margin: 0, marginTop: 4 }}>Stories Shared</p>
        </div>
        <div style={{ background: "var(--ink-1)", border: "1px solid var(--ink-3)", borderRadius: 20, padding: 24 }}>
          <Clock style={{ color: "var(--moss)", marginBottom: 16 }} />
          <h3 style={{ fontSize: 24, fontWeight: "bold", color: "var(--paper)", margin: 0 }}>0 min</h3>
          <p style={{ fontSize: 14, color: "var(--paper-dim)", margin: 0, marginTop: 4 }}>Time Listened Together</p>
        </div>
      </div>

      {/* Family-tree diagram */}
      <div style={{
        position: "relative",
        background: "var(--ink-1)", border: "1px solid var(--ink-3)",
        borderRadius: 28, padding: "48px 48px 56px",
        overflow: "hidden",
        marginBottom: 40,
      }}>
        {/* connecting lines svg */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} preserveAspectRatio="none" viewBox="0 0 100 100">
          <path d="M50 22 L50 50 L15 50 L15 75 M50 50 L38 50 L38 75 M50 50 L62 50 L62 75 M50 50 L85 50 L85 75"
                stroke="rgba(244,236,219,0.12)" strokeWidth="0.2" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* root */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 64 }}>
          <div style={{
            padding: "14px 24px",
            background: "var(--ink-2)",
            border: "1px solid rgba(244,184,96,0.35)",
            borderRadius: 99,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <VoxMark size={28} color="var(--lamp)" />
            <div>
              <div className="serif" style={{ fontSize: 22, lineHeight: 1, color: "var(--paper)" }}>The Family</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>
                {clones.length} members
              </div>
            </div>
          </div>
        </div>

        {clones.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
            {clones.map(v => <CloneFullCard key={v.id} clone={v} />)}
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "var(--paper-dim)", marginTop: 40 }}>
            No family members added yet. <Link href="/onboarding" style={{ color: "var(--lamp)" }}>Add your first family member →</Link>
          </div>
        )}
      </div>

      {/* Family Settings Section */}
      <div className="fadeUp" style={{ marginTop: 80, marginBottom: 32 }}>
        <h2 className="serif" style={{ fontSize: "clamp(32px, 4vw, 48px)", margin: 0, letterSpacing: "-0.02em", color: "var(--paper)" }}>
          Family <span className="serif-italic" style={{ color: "var(--lamp)" }}>settings</span>
        </h2>
        <p style={{ color: "var(--paper-dim)", fontSize: 16, marginTop: 12 }}>
          Children, consent, and the small things that make bedtime quieter.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 80 }}>
        <SettingsCard eyebrow="CHILDREN" title="2 little readers" subtitle="Yusuf (5) • Aisha (7)" />
        <SettingsCard eyebrow="CONSENT" title="All voices verified" subtitle="Re-confirmed Mar 30" />
        <SettingsCard eyebrow="PLAN" title="Family - $19.99/mo" subtitle="Renews May 24, 2026" />
        <SettingsCard eyebrow="BEDTIME" title="9:00 pm weekdays" subtitle="Auto-dim app at 9:30" />
        <SettingsCard eyebrow="BACKGROUND" title="Soft rain by default" subtitle="Per story override" />
        <SettingsCard eyebrow="PRIVACY" title="Voices stay yours" subtitle="Never used to train models" />
      </div>

      <Section eyebrow="Recent Activity" title={<>Shared <span className="serif-italic">Moments</span></>}>
        <div style={{
          background: "var(--ink-1)", border: "1px solid var(--ink-3)",
          borderRadius: 20, overflow: "hidden",
        }}>
          <div style={{ padding: "32px", textAlign: "center", color: "var(--paper-mute)" }}>
            No activity yet. Listen to a story to create a moment.
          </div>
        </div>
      </Section>
    </div>
  );
}

function SettingsCard({ eyebrow, title, subtitle }: { eyebrow: string, title: string, subtitle: string }) {
  return (
    <div style={{
      background: "var(--ink-2)",
      border: "1px solid var(--ink-3)",
      borderRadius: 16,
      padding: "24px 32px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      transition: "background 0.2s ease, border-color 0.2s ease",
      cursor: "pointer",
    }}
    className="hover:bg-ink-3/50 hover:border-lamp/30 group"
    >
      <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", marginBottom: 12 }}>
        {eyebrow}
      </div>
      <div className="serif" style={{ fontSize: 24, color: "var(--paper)", letterSpacing: "-0.01em", marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: "var(--paper-dim)" }}>
        {subtitle}
      </div>
    </div>
  );
}
