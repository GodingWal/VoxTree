import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { contentLibrary, familyVoices, generatedClips } from "@/lib/db/schema";
import { toSnakeRow, toSnakeRows } from "@/lib/db/to-snake";
import { getCurrentUserId } from "@/lib/auth/session";
import { StoryPlayer } from "@/components/story-player";
import { TwilightShell } from "@/components/twilight-layout";
import { getPresignedDownloadUrl } from "@/lib/gcp";

interface WatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params;

  const userId = await getCurrentUserId();

  if (!userId) {
    redirect("/login");
  }

  // RLS: content_library readable by any authenticated user.
  const [content] = await db
    .select()
    .from(contentLibrary)
    .where(eq(contentLibrary.id, id))
    .limit(1);

  if (!content) {
    redirect("/browse");
  }

  // RLS owner policy: user_id = uid.
  const voices = await db
    .select()
    .from(familyVoices)
    .where(and(eq(familyVoices.userId, userId), eq(familyVoices.status, "ready")))
    .orderBy(desc(familyVoices.createdAt));

  // Check if there's already a generated clip for this content
  // (RLS owner policy: user_id = uid; family_voices(name) embed).
  const existingClips = await db
    .select({ clip: generatedClips, voiceName: familyVoices.name })
    .from(generatedClips)
    .leftJoin(familyVoices, eq(generatedClips.voiceId, familyVoices.id))
    .where(
      and(
        eq(generatedClips.userId, userId),
        eq(generatedClips.contentId, id),
        inArray(generatedClips.status, ["ready", "queued", "processing"]),
      ),
    )
    .orderBy(desc(generatedClips.createdAt));

  // Resolve presigned URLs for clips in GCS/Mock Storage
  const resolvedClips = await Promise.all(
    existingClips.map(async ({ clip, voiceName }) => {
      let audioUrl = clip.outputAudioUrl;
      let videoUrl = clip.outputVideoUrl;
      if (audioUrl && !audioUrl.startsWith("http")) {
        audioUrl = await getPresignedDownloadUrl(audioUrl);
      }
      if (videoUrl && !videoUrl.startsWith("http")) {
        videoUrl = await getPresignedDownloadUrl(videoUrl);
      }
      return {
        ...toSnakeRow(clip),
        output_audio_url: audioUrl,
        output_video_url: videoUrl,
        family_voices: voiceName ? { name: voiceName } : null,
      };
    }),
  );

  return (
    <TwilightShell>
      <StoryPlayer
        content={toSnakeRow(content) as any}
        voices={toSnakeRows(voices) as any}
        existingClips={resolvedClips as any}
      />
    </TwilightShell>
  );
}
