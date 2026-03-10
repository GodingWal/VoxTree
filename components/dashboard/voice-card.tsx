"use client";

import { useState } from "react";
import {
  Mic,
  Play,
  Pause,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  MoreVertical,
} from "lucide-react";

interface VoiceCardProps {
  voice: {
    id: string;
    name: string;
    status: string;
    sample_url?: string | null;
  };
}

export function VoiceCard({ voice }: VoiceCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [audioRef] = useState<{ current: HTMLAudioElement | null }>({
    current: null,
  });

  const handlePlaySample = () => {
    if (!voice.sample_url) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(voice.sample_url);
    audioRef.current = audio;
    audio.play();
    setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
  };

  return (
    <div className="group rounded-xl bg-white dark:bg-card border p-5 space-y-3 shadow-sm hover:shadow-md transition-shadow relative">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-brand-sage/40 dark:bg-brand-green/20 flex items-center justify-center shrink-0">
          <Mic className="h-4 w-4 text-brand-green" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-brand-charcoal dark:text-foreground truncate">
            {voice.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            {voice.status === "ready" ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span className="text-xs text-green-600 dark:text-green-400">
                  Ready
                </span>
              </>
            ) : voice.status === "processing" ? (
              <>
                <Clock className="h-3 w-3 text-brand-gold" />
                <span className="text-xs text-brand-gold">Processing</span>
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 text-brand-coral" />
                <span className="text-xs text-brand-coral">Error</span>
              </>
            )}
          </div>
        </div>

        {/* Actions menu toggle */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
          aria-label="Voice actions"
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Action buttons row */}
      <div className="flex items-center gap-2 pt-1">
        {voice.status === "ready" && voice.sample_url && (
          <button
            onClick={handlePlaySample}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-green/10 dark:bg-brand-green/20 px-3 py-1.5 text-xs font-medium text-brand-green hover:bg-brand-green/20 dark:hover:bg-brand-green/30 transition-colors"
          >
            {isPlaying ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            {isPlaying ? "Stop" : "Listen"}
          </button>
        )}
        <button className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </div>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-4 top-12 z-20 w-36 rounded-lg border bg-white dark:bg-card shadow-lg py-1">
            <button className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Pencil className="h-3 w-3" />
              Rename
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
