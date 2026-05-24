import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StoryPlayer } from "@/components/story-player";
import { TwilightShell } from "@/components/twilight-layout";
import { getPresignedDownloadUrl } from "@/lib/gcp";

interface WatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: content } = await supabase
    .from("content_library")
    .select("*")
    .eq("id", id)
    .single();

  if (!content) {
    redirect("/browse");
  }

  const { data: voices } = await supabase
    .from("family_voices")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  // Check if there's already a generated clip for this content
  const { data: existingClips } = await supabase
    .from("generated_clips")
    .select("*, family_voices(name)")
    .eq("user_id", user.id)
    .eq("content_id", id)
    .in("status", ["ready", "queued", "processing"])
    .order("created_at", { ascending: false });

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
    <TwilightShell>
      <StoryPlayer
        content={content}
        voices={voices ?? []}
        existingClips={resolvedClips}
      />
    </TwilightShell>
  );
}
