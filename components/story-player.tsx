"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  Mic,
  Loader2,
  CheckCircle2,
  Volume2,
  VolumeX,
  RotateCcw,
  Clock,
  BookOpen,
  Plus,
  Share2,
  Users,
} from "lucide-react";
import Image from "next/image";

interface Voice {
  id: string;
  name: string;
  status: string;
  sample_audio_url?: string | null;
}

interface Content {
  id: string;
  title: string;
  series: string | null;
  episode_number: number | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  age_range: string | null;
  tags: string[];
  is_premium: boolean;
}

interface Clip {
  id: string;
  voice_id: string;
  status: string;
  output_audio_url: string | null;
  output_video_url: string | null;
  family_voices: { name: string } | null;
}

interface StoryPlayerProps {
  content: Content;
  voices: Voice[];
  existingClips: Clip[];
}

type PlayerState = "idle" | "generating" | "ready" | "playing" | "paused";

export function StoryPlayer({ content, voices, existingClips }: StoryPlayerProps) {
  const [selectedVoice, setSelectedVoice] = useState<string>(
    voices[0]?.id ?? ""
  );
  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Check for existing ready clip when voice changes
  useEffect(() => {
    const existing = existingClips.find(
      (c) => c.voice_id === selectedVoice && c.status === "ready"
    );
    if (existing?.output_audio_url || existing?.output_video_url) {
      setClipUrl(existing.output_audio_url ?? existing.output_video_url);
      setPlayerState("ready");
    } else {
      setClipUrl(null);
      setPlayerState("idle");
    }
    // Reset audio when voice changes
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setProgress(0);
    setDuration(0);
  }, [selectedVoice, existingClips]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  async function handleGenerate() {
    if (!selectedVoice) return;
    setError(null);
    setPlayerState("generating");

    try {
      const res = await fetch("/api/clips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: content.id,
          voiceId: selectedVoice,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setPlayerState("idle");
        return;
      }

      if (data.status === "ready" && data.videoUrl) {
        setClipUrl(data.videoUrl);
        setPlayerState("ready");
      } else if (data.status === "queued") {
        pollClipStatus(data.clipId);
      }
    } catch {
      setError("Network error. Please try again.");
      setPlayerState("idle");
    }
  }

  async function pollClipStatus(clipId: string) {
    let attempts = 0;
    const maxAttempts = 60;

    const poll = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(poll);
        setError("Generation is taking longer than expected. Please check back later.");
        setPlayerState("idle");
        return;
      }

      try {
        const res = await fetch(`/api/clips/${clipId}/status`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "ready" && data.url) {
          clearInterval(poll);
          setClipUrl(data.url);
          setPlayerState("ready");
        } else if (data.status === "failed") {
          clearInterval(poll);
          setError("Generation failed. Please try again.");
          setPlayerState("idle");
        }
      } catch {
        // Retry on network error
      }
    }, 3000);
  }

  function handlePlayPause() {
    if (!clipUrl) return;

    if (playerState === "playing") {
      audioRef.current?.pause();
      setPlayerState("paused");
      if (progressInterval.current) clearInterval(progressInterval.current);
      return;
    }

    if (playerState === "paused" && audioRef.current) {
      audioRef.current.play();
      setPlayerState("playing");
      startProgressTracking();
      return;
    }

    const audio = new Audio(clipUrl);
    audioRef.current = audio;
    audio.muted = muted;

    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);
    });

    audio.addEventListener("ended", () => {
      setPlayerState("ready");
      setProgress(0);
      if (progressInterval.current) clearInterval(progressInterval.current);
    });

    audio.addEventListener("error", () => {
      setError("Failed to play audio. Please try again.");
      setPlayerState("ready");
    });

    audio.play();
    setPlayerState("playing");
    startProgressTracking();
  }

  function startProgressTracking() {
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = setInterval(() => {
      if (audioRef.current) {
        setProgress(audioRef.current.currentTime);
        setDuration(audioRef.current.duration || 0);
      }
    }, 200);
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = fraction * duration;
    setProgress(fraction * duration);
  }

  function handleRestart() {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setProgress(0);
      if (playerState !== "playing") {
        audioRef.current.play();
        setPlayerState("playing");
        startProgressTracking();
      }
    }
  }

  function toggleMute() {
    setMuted((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function handleShare() {
    if (clipUrl) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const selectedVoiceName = voices.find((v) => v.id === selectedVoice)?.name ?? "";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Story Hero */}
      <div className="rounded-2xl overflow-hidden border bg-white dark:bg-card shadow-lg hover:shadow-xl transition-all">
        {/* Thumbnail / Cover Art */}
        <div className="relative aspect-[21/9] bg-gradient-to-br from-brand-green/20 via-brand-sage/30 to-brand-coral/10 group">
          {content.thumbnail_url ? (
            <Image
              src={content.thumbnail_url}
              alt={content.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="h-16 w-16 text-brand-green/30" />
            </div>
          )}
          {content.is_premium && (
            <span className="absolute top-4 right-4 rounded-full bg-brand-gold px-3 py-1 text-xs font-bold text-white shadow-sm">
              Premium
            </span>
          )}
        </div>

        {/* Story Info */}
        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-brand-charcoal dark:text-foreground">
                {content.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {content.series && (
                  <span>{content.series}{content.episode_number != null && ` · Ep. ${content.episode_number}`}</span>
                )}
                {content.age_range && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-sage/20 px-2.5 py-0.5 text-xs font-medium text-brand-green">
                    Ages {content.age_range}
                  </span>
                )}
                {content.duration_seconds && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {Math.ceil(content.duration_seconds / 60)} min
                  </span>
                )}
              </div>
            </div>
            {/* Share Button (Only available if clip is ready) */}
            {playerState !== "idle" && playerState !== "generating" && (
              <button
                onClick={handleShare}
                className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-brand-green/10 px-4 py-2 text-sm font-medium text-brand-green hover:bg-brand-green/20 transition-colors"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                {copied ? "Copied!" : "Share with Family"}
              </button>
            )}
          </div>

          {content.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {content.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Voice Selector / Multi-Character Casting UI */}
      <div className="rounded-2xl border bg-white dark:bg-card p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-green/10 p-2.5">
              <Users className="h-5 w-5 text-brand-green" />
            </div>
            <div>
              <h2 className="font-semibold text-brand-charcoal dark:text-foreground">
                Cast your Clones
              </h2>
              <p className="text-sm text-muted-foreground">
                Select who will narrate this story
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-brand-gold bg-brand-gold/10 px-3 py-1.5 rounded-full">
            <Sparkles className="h-3.5 w-3.5" />
            More roles coming soon
          </div>
        </div>

        {/* Character Role Selection Group */}
        <div className="pt-4 border-t border-border">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Role: Narrator
            </span>
          </div>
          {voices.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {voices.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice.id)}
                  disabled={playerState === "generating"}
                  className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                    selectedVoice === voice.id
                      ? "border-brand-green bg-brand-green/5 dark:bg-brand-green/10 shadow-sm hover:-translate-y-0.5"
                      : "border-transparent bg-muted/50 hover:bg-muted hover:border-muted hover:-translate-y-0.5"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      selectedVoice === voice.id
                        ? "bg-brand-green text-white shadow-md shadow-brand-green/20"
                        : "bg-brand-sage/40 dark:bg-brand-sage/20 text-brand-green"
                    }`}
                  >
                    <Mic className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-brand-charcoal dark:text-foreground truncate">
                      {voice.name}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Ready
                    </p>
                  </div>
                  {selectedVoice === voice.id && (
                    <div className="ml-auto shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-brand-green" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-brand-sage/40 bg-brand-sage/5 p-8 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mb-3">
                <Mic className="h-5 w-5 text-brand-green/60" />
              </div>
              <p className="text-sm font-medium text-brand-charcoal dark:text-foreground">
                No voices available
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Add a family voice clone to cast them in this story.
              </p>
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-brand-green hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Add your first voice
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Player Section */}
      <div className="rounded-2xl border bg-white dark:bg-card shadow-lg overflow-hidden group">
        {/* Main Play Button Area */}
        <div className="p-8 sm:p-12 flex flex-col items-center text-center space-y-6 relative overflow-hidden">
          {/* Subtle background pulse for generating state */}
          {playerState === "generating" && (
            <div className="absolute inset-0 bg-brand-gold/5 animate-pulse" />
          )}
          
          {/* Big Play Button */}
          <button
            onClick={
              playerState === "idle" || playerState === "generating"
                ? handleGenerate
                : handlePlayPause
            }
            disabled={
              !selectedVoice ||
              playerState === "generating" ||
              voices.length === 0
            }
            className={`relative z-10 h-28 w-28 sm:h-32 sm:w-32 rounded-full flex items-center justify-center transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              playerState === "playing"
                ? "bg-brand-coral shadow-2xl shadow-brand-coral/40 hover:scale-105"
                : playerState === "generating"
                  ? "bg-brand-gold shadow-2xl shadow-brand-gold/40"
                  : "bg-brand-green shadow-2xl shadow-brand-green/40 hover:scale-105 active:scale-95"
            }`}
          >
            {playerState === "generating" ? (
              <Loader2 className="h-12 w-12 sm:h-14 sm:w-14 text-white animate-spin" />
            ) : playerState === "playing" ? (
              <Pause className="h-12 w-12 sm:h-14 sm:w-14 text-white" />
            ) : (
              <Play className="h-12 w-12 sm:h-14 sm:w-14 text-white ml-1.5" />
            )}
          </button>

          {/* Status text */}
          <div className="space-y-1 relative z-10 transition-all">
            {playerState === "idle" && selectedVoice && (
              <p className="text-lg font-medium text-brand-charcoal dark:text-foreground">
                Press play to generate & listen
              </p>
            )}
            {playerState === "idle" && selectedVoice && (
              <p className="text-sm text-muted-foreground">
                Narrated by {selectedVoiceName}
              </p>
            )}
            {playerState === "generating" && (
              <div className="animate-in fade-in slide-in-from-bottom-2">
                <p className="text-lg font-bold text-brand-gold">
                  Preparing your story...
                </p>
                <p className="text-sm text-muted-foreground">
                  Cloning voice and rendering audio
                </p>
              </div>
            )}
            {playerState === "ready" && (
              <div className="animate-in fade-in zoom-in-95">
                <p className="text-lg font-bold text-brand-green">
                  Ready to play
                </p>
                <p className="text-sm text-muted-foreground">
                  Narrated by {selectedVoiceName}
                </p>
              </div>
            )}
            {playerState === "playing" && (
              <p className="text-lg font-bold text-brand-coral animate-pulse">
                Now playing
              </p>
            )}
            {playerState === "paused" && (
              <>
                <p className="text-lg font-medium text-brand-charcoal dark:text-foreground">
                  Paused
                </p>
                <p className="text-sm text-muted-foreground">
                  Tap to resume
                </p>
              </>
            )}
            {!selectedVoice && voices.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Select a voice above to get started
              </p>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="relative z-10 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive max-w-sm animate-in shake">
              {error}
            </div>
          )}
        </div>

        {/* Progress Bar & Controls - shown when audio is loaded */}
        {(playerState === "playing" ||
          playerState === "paused" ||
          (playerState === "ready" && progress > 0)) && (
          <div className="border-t bg-muted/10 px-6 py-5 space-y-4 animate-in slide-in-from-bottom-4">
            {/* Progress bar */}
            <div
              className="group/progress relative h-2.5 rounded-full bg-muted cursor-pointer overflow-hidden"
              onClick={handleSeek}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-green to-brand-green/80 transition-all ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Time + controls */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded-md">
                {formatTime(progress)}
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleRestart}
                  className="rounded-full p-2.5 text-muted-foreground hover:text-brand-charcoal dark:hover:text-foreground hover:bg-white dark:hover:bg-card shadow-sm border border-transparent hover:border-border transition-all"
                  aria-label="Restart"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={toggleMute}
                  className="rounded-full p-2.5 text-muted-foreground hover:text-brand-charcoal dark:hover:text-foreground hover:bg-white dark:hover:bg-card shadow-sm border border-transparent hover:border-border transition-all"
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? (
                    <VolumeX className="h-4 w-4 text-brand-coral" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
              </div>

              <span className="text-xs font-medium text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded-md">
                {duration > 0 ? formatTime(duration) : "--:--"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
