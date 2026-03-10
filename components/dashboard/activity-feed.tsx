import {
  Mic,
  Play,
  CheckCircle2,
  AlertCircle,
  Bell,
  Clock,
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: "voice_ready" | "voice_processing" | "voice_error" | "clip_created" | "new_content";
  message: string;
  timestamp: string;
}

interface ActivityFeedProps {
  voices: Array<{
    id: string;
    name: string;
    status: string;
    created_at: string;
    updated_at?: string;
  }>;
  clips: Array<{
    id: string;
    created_at: string;
    content_library?: { title?: string } | null;
    family_voices?: { name?: string } | null;
  }>;
}

export function ActivityFeed({ voices, clips }: ActivityFeedProps) {
  const activities: ActivityItem[] = [];

  // Build activity items from voices
  for (const voice of voices) {
    if (voice.status === "ready") {
      activities.push({
        id: `voice-ready-${voice.id}`,
        type: "voice_ready",
        message: `${voice.name}'s voice is ready to use!`,
        timestamp: voice.updated_at ?? voice.created_at,
      });
    } else if (voice.status === "processing") {
      activities.push({
        id: `voice-proc-${voice.id}`,
        type: "voice_processing",
        message: `${voice.name}'s voice is being processed...`,
        timestamp: voice.created_at,
      });
    } else if (voice.status === "error") {
      activities.push({
        id: `voice-err-${voice.id}`,
        type: "voice_error",
        message: `There was an issue with ${voice.name}'s voice.`,
        timestamp: voice.updated_at ?? voice.created_at,
      });
    }
  }

  // Build activity items from clips
  for (const clip of clips) {
    const contentTitle =
      (clip.content_library as Record<string, unknown> | null)?.title as string | undefined ??
      "a video";
    const voiceName =
      (clip.family_voices as Record<string, unknown> | null)?.name as string | undefined;
    activities.push({
      id: `clip-${clip.id}`,
      type: "clip_created",
      message: voiceName
        ? `Created "${contentTitle}" with ${voiceName}'s voice.`
        : `Created "${contentTitle}".`,
      timestamp: clip.created_at,
    });
  }

  // Sort by timestamp descending, take top 5
  activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const recent = activities.slice(0, 5);

  if (recent.length === 0) {
    return (
      <div className="rounded-xl bg-white dark:bg-card border p-6 text-center shadow-sm">
        <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No recent activity</p>
      </div>
    );
  }

  const iconMap = {
    voice_ready: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50 dark:bg-green-500/10" },
    voice_processing: { icon: Clock, color: "text-brand-gold", bg: "bg-brand-gold/10" },
    voice_error: { icon: AlertCircle, color: "text-brand-coral", bg: "bg-brand-coral/10" },
    clip_created: { icon: Play, color: "text-brand-green", bg: "bg-brand-green/10" },
    new_content: { icon: Mic, color: "text-brand-green", bg: "bg-brand-green/10" },
  };

  function formatRelativeTime(timestamp: string): string {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="rounded-xl bg-white dark:bg-card border shadow-sm divide-y">
      {recent.map((activity) => {
        const { icon: Icon, color, bg } = iconMap[activity.type];
        return (
          <div key={activity.id} className="flex items-start gap-3 p-4">
            <div
              className={`mt-0.5 rounded-full p-1.5 shrink-0 ${bg}`}
            >
              <Icon className={`h-3.5 w-3.5 ${color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-brand-charcoal dark:text-foreground">
                {activity.message}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatRelativeTime(activity.timestamp)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
