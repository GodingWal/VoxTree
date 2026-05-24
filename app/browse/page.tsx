import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { TwilightShell } from "@/components/twilight-layout";
import { StoryArt, Section, TextLink } from "@/components/twilight-ui";

type ContentItem = {
  id: string;
  title: string;
  series: string | null;
  episode_number: number | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  age_range: string | null;
  tags: string[];
  is_premium: boolean;
  content_type: string;
};

// Map content type/tags to an art kind
function getArtKind(c: ContentItem) {
  if (c.title.toLowerCase().includes("moon")) return "moon";
  if (c.title.toLowerCase().includes("owl")) return "owl";
  if (c.title.toLowerCase().includes("snow")) return "snow";
  if (c.title.toLowerCase().includes("earth")) return "forest";
  if (c.title.toLowerCase().includes("river")) return "river";
  if (c.title.toLowerCase().includes("star")) return "stars";
  if (c.title.toLowerCase().includes("cloud")) return "cloud";
  return "lantern";
}

function getColor(c: ContentItem) {
  const hash = c.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = ["#E8856C", "#F4B860", "#7FC4A4", "#C58FB8", "#A3A7C9"];
  return colors[hash % colors.length];
}

export default async function BrowsePage() {
  const supabase = createClient();

  const { data: rawContent } = await supabase
    .from("content_library")
    .select("*")
    .order("created_at", { ascending: false });

  const content = (rawContent ?? []) as ContentItem[];

  return (
    <TwilightShell>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 24px" }}>
        <div className="fadeUp" style={{ marginBottom: 40 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
            The Library
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0, letterSpacing: "-0.02em", maxWidth: 900 }}>
            {content.length} stories,<br/>
            <span className="serif-italic" style={{ color: "var(--lamp)" }}>narrated by the people who love them most.</span>
          </h1>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32, alignItems: "center" }}>
          {["All stories", "Goodnight Tales", "Earth Songs", "Under 10 min"].map((lbl, i) => (
            <button key={i} style={{
              padding: "9px 16px",
              background: i === 0 ? "var(--paper)" : "transparent",
              color: i === 0 ? "var(--ink-0)" : "var(--paper-dim)",
              border: `1px solid ${i === 0 ? "var(--paper)" : "var(--ink-3)"}`,
              borderRadius: 99, fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}>{lbl}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Ready to read
          </div>
        </div>

        {content.length > 0 && (
          <FeaturedRow story={content[0]} />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20, marginTop: 40 }}>
          {content.slice(1).map(s => (
            <Link key={s.id} href={`/watch/${s.id}`} style={{
              textAlign: "left", display: "block", width: "100%", textDecoration: "none",
              background: "var(--ink-2)", border: "1px solid var(--ink-3)",
              borderRadius: 20, overflow: "hidden", padding: 0,
              transition: "transform .25s ease, border-color .2s",
            }}>
              <StoryArt kind={getArtKind(s)} color={getColor(s)} height={170} />
              <div style={{ padding: 18 }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", marginBottom: 8 }}>
                  {s.series || "Standalone"} {s.episode_number ? `· Ep ${s.episode_number}` : ""}
                </div>
                <h3 className="serif" style={{ fontSize: 22, margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em", color: "var(--paper)" }}>
                  {s.title}
                </h3>
                <div style={{ display: "flex", gap: 10, marginTop: 14, fontSize: 12, color: "var(--paper-dim)" }}>
                  <span style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(244,236,219,0.06)", border: "1px solid transparent", color: "var(--paper-dim)" }}>
                    {s.duration_seconds ? Math.ceil(s.duration_seconds / 60) : 10} min
                  </span>
                  {s.age_range && (
                    <span style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(244,236,219,0.06)", border: "1px solid transparent", color: "var(--paper-dim)" }}>
                      Ages {s.age_range}
                    </span>
                  )}
                  {s.is_premium && (
                    <span style={{ padding: "3px 10px", borderRadius: 99, background: "transparent", border: "1px solid var(--ink-3)", color: "var(--paper-dim)" }}>
                      Premium
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </TwilightShell>
  );
}

function FeaturedRow({ story }: { story: ContentItem }) {
  if (!story) return null;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1.1fr 1fr",
      background: "var(--ink-1)", border: "1px solid var(--ink-3)",
      borderRadius: 28, overflow: "hidden", minHeight: 360,
    }}>
      <div style={{ position: "relative" }}>
        <StoryArt kind={getArtKind(story)} color={getColor(story)} height="100%" />
      </div>
      <div style={{ padding: "44px 44px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 14 }}>
          Featured
        </div>
        <h2 className="serif" style={{ fontSize: 44, lineHeight: 1.05, margin: 0, letterSpacing: "-0.02em", color: "var(--paper)" }}>
          {story.title}
        </h2>
        <p style={{ marginTop: 16, color: "var(--paper-dim)", lineHeight: 1.6, maxWidth: 460, fontSize: 15 }}>
          A drowsy moon refuses to set, and the children of the village must coax it gently back to sleep with old lullabies — the kind only grandmothers remember.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 28, alignItems: "center" }}>
          <Link href={`/watch/${story.id}`} style={{
            padding: "14px 22px", background: "var(--lamp)", color: "var(--ink-0)",
            border: 0, borderRadius: 99, fontWeight: 600, fontSize: 14, cursor: "pointer", textDecoration: "none"
          }}>▸ &nbsp; Read now</Link>
          <button style={{
            padding: "14px 22px", background: "transparent", color: "var(--paper)",
            border: "1px solid var(--ink-3)", borderRadius: 99, fontSize: 14, cursor: "pointer",
          }}>Save for later</button>
        </div>
      </div>
    </div>
  );
}
