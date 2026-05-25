import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StoriesDiscovery } from "@/components/stories-discovery";

export default async function StoriesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all stories from the content library
  const { data: stories } = await supabase
    .from("content_library")
    .select("*")
    .eq("content_type", "story")
    .order("series", { ascending: true })
    .order("episode_number", { ascending: true });

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 80px" }}>
      <div className="fadeUp" style={{ textAlign: "center", marginBottom: 48 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
          Story Time
        </div>
        <h1 className="serif" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: "0 auto 16px", letterSpacing: "-0.02em", color: "var(--paper)", maxWidth: 800 }}>
          Discover stories,<br/><span className="serif-italic" style={{ color: "var(--lamp)" }}>add them to your world.</span>
        </h1>
        <p style={{ color: "var(--paper-mute)", marginTop: 16, maxWidth: 560, margin: "0 auto", fontSize: 16, lineHeight: 1.5 }}>
          Spin through our collection of bedtime tales. Select the ones you love 
          and they'll appear in your library, ready to be narrated by your clones.
        </p>
      </div>

      <StoriesDiscovery stories={stories ?? []} />
    </div>
  );
}
