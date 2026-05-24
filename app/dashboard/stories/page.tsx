import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { StoriesPlayer } from "@/components/stories-player";
import { getPresignedDownloadUrl } from "@/lib/gcp";

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
    .order("series", { ascending: true })
    .order("episode_number", { ascending: true });

  // Fetch user's ready voice clones
  const { data: voices } = await supabase
    .from("family_voices")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  // Fetch any existing generated clips for this user
  const { data: existingClips } = await supabase
    .from("generated_clips")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ready");

  // Resolve presigned URLs for clips in GCS/Mock Storage
  const resolvedClips = existingClips
    ? await Promise.all(
        existingClips.map(async (clip) => {
          let audioUrl = clip.output_audio_url;
          let videoUrl = clip.output_video_url;
          if (audioUrl && !audioUrl.startsWith("http")) {
            audioUrl = await getPresignedDownloadUrl(audioUrl);
          }
          if (videoUrl && !videoUrl.startsWith("http")) {
            videoUrl = await getPresignedDownloadUrl(videoUrl);
          }
          return {
            ...clip,
            output_audio_url: audioUrl,
            output_video_url: videoUrl,
          };
        })
      )
    : [];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 24px" }}>
      <div className="fadeUp" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, gap: 24 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
            Story Time
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0, letterSpacing: "-0.02em", color: "var(--paper)" }}>
            Stories, <span className="serif-italic" style={{ color: "var(--lamp)" }}>narrated by your family.</span>
          </h1>
          <p style={{ color: "var(--paper-mute)", marginTop: 16, maxWidth: 600, fontSize: 16, lineHeight: 1.5 }}>
            Listen to classic tales and original stories narrated with the voices you have cloned. 
            Perfect for bedtime, road trips, or simply unwinding.
          </p>
        </div>
      </div>

      <StoriesPlayer
        stories={stories ?? []}
        voices={voices ?? []}
        existingClips={resolvedClips}
      />
    </div>
  );
}
