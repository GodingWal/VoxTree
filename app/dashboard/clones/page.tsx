import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CloneFullCard } from "@/components/twilight-ui";
import { VoxMark } from "@/components/voxtree-logo";

export default async function ClonesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const familyName = profile?.name ? `${profile.name.split(' ')[0]}'s family` : "The Family";

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
      relation: "Family Member",
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
            Your voice tree
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0, letterSpacing: "-0.02em", color: "var(--paper)" }}>
            {familyName},<br/><span className="serif-italic" style={{ color: "var(--lamp)" }}>read aloud.</span>
          </h1>
        </div>
        <Link href="/onboarding" style={{
          padding: "14px 22px",
          background: "var(--lamp)", color: "var(--ink-0)",
          border: 0, borderRadius: 99, textDecoration: "none",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>＋ &nbsp;Add a voice</Link>
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
              <div className="serif" style={{ fontSize: 22, lineHeight: 1, color: "var(--paper)" }}>{familyName}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>
                {clones.length} voices • 0 reads
              </div>
            </div>
          </div>
        </div>

        {clones.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
            {clones.map(v => (
              <Link key={v.id} href={`/dashboard/clones/${v.id}`} style={{ textDecoration: 'none' }} title="Click to manage clones (Voice, Singing, Face, Body)">
                <div style={{ pointerEvents: 'none' }}>
                  <CloneFullCard clone={v} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "var(--paper-dim)", marginTop: 40 }}>
            No voices added yet. <Link href="/onboarding" style={{ color: "var(--lamp)" }}>Add your first voice →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
