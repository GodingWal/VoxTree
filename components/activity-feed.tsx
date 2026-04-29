import { CheckCircle2, Clock, Play, AlertCircle } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "voice_ready" | "voice_processing" | "voice_error" | "clip_ready";
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
    status: string;
    created_at: string;
    content_library?: { title: string } | null;
    family_voices?: { name: string } | null;
  }>;
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function ActivityFeed({ voices, clips }: ActivityFeedProps) {
  const activities: ActivityItem[] = [];

  for (const voice of voices) {
    if (voice.status === "ready") {
      activities.push({
        id: `voice-ready-${voice.id}`,
        type: "voice_ready",
        message: `${voice.name}'s voice is ready!`,
        timestamp: voice.updated_at ?? voice.created_at,
      });
    } else if (voice.status === "processing") {
      activities.push({
        id: `voice-processing-${voice.id}`,
        type: "voice_processing",
        message: `${voice.name}'s voice is processing...`,
        timestamp: voice.created_at,
      });
    } else if (voice.status === "failed") {
      activities.push({
        id: `voice-error-${voice.id}`,
        type: "voice_error",
        message: `${voice.name}'s voice encountered an error`,
        timestamp: voice.updated_at ?? voice.created_at,
      });
    }
  }

  for (const clip of clips) {
    const title = clip.content_library?.title ?? "a story";
    const voiceName = clip.family_voices?.name ?? "a voice";
    activities.push({
      id: `clip-${clip.id}`,
      type: "clip_ready",
      message: `New clip: "${title}" with ${voiceName}`,
      timestamp: clip.created_at,
    });
  }

  activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const recentActivities = activities.slice(0, 5);

  if (recentActivities.length === 0) {
    return null;
  }

  const iconMap = {
    voice_ready: {
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-50 dark:bg-green-500/10",
    },
    voice_processing: {
      icon: Clock,
      color: "text-brand-gold",
      bg: "bg-brand-gold/10",
    },
    voice_error: {
      icon: AlertCircle,
      color: "text-brand-coral",
      bg: "bg-brand-coral/10",
    },
    clip_ready: {
      icon: Play,
      color: "text-brand-green",
      bg: "bg-brand-green/10",
    },
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-brand-charcoal dark:text-foreground">
        Recent Activity
      </h2>
      <div className="rounded-xl bg-white dark:bg-card border divide-y">
        {recentActivities.map((activity) => {
          const { icon: Icon, color, bg } = iconMap[activity.type];
          return (
            <div
              key={activity.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div
                className={`shrink-0 rounded-full p-1.5 ${bg}`}
              >
                <Icon className={`h-3.5 w-3.5 ${color}`} />
              </div>
              <p className="text-sm text-foreground flex-1 min-w-0 truncate">
                {activity.message}
              </p>
              <span className="text-xs text-muted-foreground shrink-0">
                {timeAgo(activity.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
