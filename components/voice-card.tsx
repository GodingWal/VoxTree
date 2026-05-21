"use client";

import { useRef, useState } from "react";
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
  Wand2,
  Loader2,
} from "lucide-react";

interface VoiceCardProps {
  voice: {
    id: string;
    name: string;
    status: string;
    sample_audio_url?: string | null;
  };
}

export function VoiceCard({ voice }: VoiceCardProps) {
  const [playing, setPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);
  const [sandboxText, setSandboxText] = useState("");
  const [generating, setGenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function handlePlaySample() {
    if (!voice.sample_audio_url) return;

    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }

    const audioUrl = `/api/voices/download?voiceId=${voice.id}`;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play();
    setPlaying(true);
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
  }

  function handleTestClone(e: React.FormEvent) {
    e.preventDefault();
    if (!sandboxText.trim()) return;

    setGenerating(true);
    
    // Simulate generation delay for the UI prototype
    setTimeout(() => {
      setGenerating(false);
      // Fallback to sample audio for prototype since we don't have a live text-to-speech endpoint yet
      if (voice.sample_audio_url) {
        handlePlaySample();
      }
    }, 1500);
  }

  return (
    <div className="group rounded-xl bg-white dark:bg-card border p-5 space-y-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 relative">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-brand-sage/40 dark:bg-brand-sage/20 flex items-center justify-center shrink-0">
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

        {/* Actions menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            aria-label="Voice actions"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-lg border bg-white dark:bg-card shadow-lg py-1">
                <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit name
                </button>
                <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete voice
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {voice.status === "ready" && (
        <div className="space-y-3 pt-2">
          {!showSandbox ? (
            <div className="flex gap-2">
              <button
                onClick={handlePlaySample}
                disabled={!voice.sample_audio_url}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-brand-green/20 bg-brand-green/5 dark:bg-brand-green/10 px-3 py-2 text-sm font-medium text-brand-green hover:bg-brand-green/10 dark:hover:bg-brand-green/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {playing ? (
                  <>
                    <Pause className="h-3.5 w-3.5" /> Stop
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Sample
                  </>
                )}
              </button>
              <button
                onClick={() => setShowSandbox(true)}
                className="flex items-center justify-center gap-2 rounded-lg border border-brand-sage bg-brand-sage/10 px-3 py-2 text-sm font-medium text-brand-charcoal dark:text-foreground hover:bg-brand-sage/20 transition-colors"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Test
              </button>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/20 p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-charcoal dark:text-foreground uppercase tracking-wider">
                  Test your Clone
                </span>
                <button 
                  onClick={() => setShowSandbox(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={handleTestClone} className="space-y-2">
                <input
                  type="text"
                  placeholder="Type something..."
                  value={sandboxText}
                  onChange={(e) => setSandboxText(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-inner placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-green"
                  disabled={generating || playing}
                />
                <button
                  type="submit"
                  disabled={!sandboxText.trim() || generating || playing}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-brand-green px-3 py-2 text-sm font-medium text-white hover:bg-brand-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : playing ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      Playing...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Generate Audio
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
