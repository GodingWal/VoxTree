"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Loader2,
  Mic,
  CheckCircle2,
  BookOpen,
  Clock,
  Share2,
  ListMusic,
  ChevronDown,
} from "lucide-react";

interface Voice {
  id: string;
  name: string;
  status: string;
}

interface Story {
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
  content_id: string;
  status: string;
  output_audio_url: string | null;
  output_video_url: string | null;
}

interface StoriesPlayerProps {
  stories: Story[];
  voices: Voice[];
  existingClips: Clip[];
}

export function StoriesPlayer({ stories, voices, existingClips }: StoriesPlayerProps) {
  const [selectedVoice, setSelectedVoice] = useState<string>(voices[0]?.id ?? "");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [copied, setCopied] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);

  const currentStory = stories[currentIndex];

  // Find existing clip for current story + voice
  const findClip = useCallback(
    (storyId: string) =>
      existingClips.find(
        (c) => c.content_id === storyId && c.voice_id === selectedVoice && c.status === "ready"
      ),
    [existingClips, selectedVoice]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  // Setup Media Session API for lock-screen controls
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentStory?.title ?? "VoxTree Story",
      artist: voices.find((v) => v.id === selectedVoice)?.name ?? "VoxTree",
      album: currentStory?.series ?? "VoxTree Stories",
      artwork: currentStory?.thumbnail_url
        ? [{ src: currentStory.thumbnail_url, sizes: "512x512", type: "image/png" }]
        : [],
    });

    navigator.mediaSession.setActionHandler("play", () => handlePlayPause());
    navigator.mediaSession.setActionHandler("pause", () => handlePlayPause());
    navigator.mediaSession.setActionHandler("previoustrack", () => skipTo(currentIndex - 1));
    navigator.mediaSession.setActionHandler("nexttrack", () => skipTo(currentIndex + 1));

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, selectedVoice, isPlaying]);

  function startProgressTracking() {
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      if (audioRef.current) {
        setProgress(audioRef.current.currentTime);
        setDuration(audioRef.current.duration || 0);
      }
    }, 250);
  }

  async function handlePlayPause() {
    if (!currentStory) return;

    // If already playing, toggle pause
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
      if (progressTimer.current) clearInterval(progressTimer.current);
      return;
    }

    // If paused with existing audio, resume
    if (!isPlaying && audioRef.current && audioRef.current.src) {
      audioRef.current.play();
      setIsPlaying(true);
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
      startProgressTracking();
      return;
    }

    // Try to find existing clip
    const clip = findClip(currentStory.id);
    if (clip) {
      const url = clip.output_audio_url ?? clip.output_video_url;
      if (url) {
        playAudioUrl(url);
        return;
      }
    }

    // Generate new clip
    await generateAndPlay(currentStory.id);
  }

  async function generateAndPlay(storyId: string) {
    if (!selectedVoice) return;
    setError(null);
    setIsGenerating(true);

    try {
      const res = await fetch("/api/clips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: storyId, voiceId: selectedVoice }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to generate");
        setIsGenerating(false);
        return;
      }

      if (data.status === "ready" && data.videoUrl) {
        setIsGenerating(false);
        playAudioUrl(data.videoUrl);
      } else if (data.status === "queued") {
        // Poll for completion
        pollForClip(data.clipId);
      }
    } catch {
      setError("Network error. Please try again.");
      setIsGenerating(false);
    }
  }

  async function pollForClip(clipId: string) {
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      if (attempts > 60) {
        clearInterval(poll);
        setError("Taking too long. Please try again later.");
        setIsGenerating(false);
        return;
      }
      try {
        const res = await fetch(`/api/clips/${clipId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "ready" && data.url) {
          clearInterval(poll);
          setIsGenerating(false);
          playAudioUrl(data.url);
        } else if (data.status === "failed") {
          clearInterval(poll);
          setError("Generation failed.");
          setIsGenerating(false);
        }
      } catch {
        // retry
      }
    }, 3000);
  }

  function playAudioUrl(url: string) {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.muted = muted;

    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setProgress(0);
      if (progressTimer.current) clearInterval(progressTimer.current);
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
      // Auto-advance to next story
      if (currentIndex < stories.length - 1) {
        skipTo(currentIndex + 1);
      }
    });
    audio.addEventListener("error", () => {
      setError("Playback failed.");
      setIsPlaying(false);
    });

    audio.play();
    setIsPlaying(true);
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    startProgressTracking();
  }

  function skipTo(index: number) {
    if (index < 0 || index >= stories.length) return;

    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setError(null);
    if (progressTimer.current) clearInterval(progressTimer.current);

    setCurrentIndex(index);

    // Auto-play if a clip exists for the new story
    const clip = findClip(stories[index].id);
    if (clip) {
      const url = clip.output_audio_url ?? clip.output_video_url;
      if (url) {
        setTimeout(() => playAudioUrl(url), 100);
      }
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = frac * duration;
    setProgress(frac * duration);
  }

  function toggleMute() {
    setMuted((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  if (stories.length === 0) {
    return (
      <div className="rounded-2xl border bg-white/50 dark:bg-card/50 p-12 text-center flex flex-col items-center justify-center animate-in fade-in">
        <div className="mx-auto w-16 h-16 rounded-full bg-brand-sage/20 flex items-center justify-center mb-4">
          <BookOpen className="h-8 w-8 text-brand-green/50" />
        </div>
        <p className="text-lg font-semibold text-brand-charcoal dark:text-foreground">No stories yet</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          New personalized stories are being added. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Voice Selector */}
      {voices.length > 0 && (
        <div className="rounded-2xl border bg-white dark:bg-card p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Narrator
          </p>
          <div className="flex flex-wrap gap-2">
            {voices.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVoice(v.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  selectedVoice === v.id
                    ? "bg-brand-green text-white shadow-md shadow-brand-green/20"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <Mic className="h-3.5 w-3.5" />
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Now Playing Card */}
      <div className="rounded-2xl border bg-white dark:bg-card shadow-lg overflow-hidden">
        {/* Album Art */}
        <div className="relative aspect-[21/9] bg-gradient-to-br from-brand-green/20 via-brand-sage/30 to-brand-coral/10 group">
          {currentStory?.thumbnail_url ? (
            <Image
              src={currentStory.thumbnail_url}
              alt={currentStory.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="h-16 w-16 text-brand-green/30" />
            </div>
          )}
          {/* Gradient overlay at bottom for text legibility */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">
                {currentStory?.title}
              </h2>
              <div className="flex items-center gap-3 text-white/80 text-sm mt-1">
                {currentStory?.series && <span>{currentStory.series}</span>}
                {currentStory?.age_range && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-sm px-2 py-0.5 text-xs">
                    Ages {currentStory.age_range}
                  </span>
                )}
                {currentStory?.duration_seconds && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.ceil(currentStory.duration_seconds / 60)} min
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleShare}
              className="rounded-full bg-white/20 backdrop-blur-sm p-2.5 text-white hover:bg-white/30 transition-colors"
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="p-6 space-y-5">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div
              className="relative h-2 rounded-full bg-muted cursor-pointer overflow-hidden group"
              onClick={handleSeek}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-brand-green transition-all ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>{fmt(progress)}</span>
              <span>{duration > 0 ? fmt(duration) : "--:--"}</span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => skipTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="rounded-full p-3 text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <SkipBack className="h-5 w-5" />
            </button>

            <button
              onClick={handlePlayPause}
              disabled={isGenerating || !selectedVoice || voices.length === 0}
              className={`h-16 w-16 rounded-full flex items-center justify-center shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isPlaying
                  ? "bg-brand-coral shadow-brand-coral/30 hover:scale-105"
                  : isGenerating
                    ? "bg-brand-gold shadow-brand-gold/30"
                    : "bg-brand-green shadow-brand-green/30 hover:scale-105 active:scale-95"
              }`}
            >
              {isGenerating ? (
                <Loader2 className="h-7 w-7 text-white animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-7 w-7 text-white" />
              ) : (
                <Play className="h-7 w-7 text-white ml-0.5" />
              )}
            </button>

            <button
              onClick={() => skipTo(currentIndex + 1)}
              disabled={currentIndex >= stories.length - 1}
              className="rounded-full p-3 text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>

          {/* Secondary Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={toggleMute}
              className="rounded-full p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              {muted ? <VolumeX className="h-4 w-4 text-brand-coral" /> : <Volume2 className="h-4 w-4" />}
            </button>

            {isGenerating && (
              <p className="text-sm text-brand-gold font-medium animate-pulse">
                Generating story...
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <button
              onClick={() => setShowQueue(!showQueue)}
              className={`rounded-full p-2.5 transition-all ${
                showQueue
                  ? "text-brand-green bg-brand-green/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <ListMusic className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Queue / Story List */}
      <div className={`rounded-2xl border bg-white dark:bg-card shadow-sm overflow-hidden transition-all ${showQueue ? "" : "hidden"}`}>
        <button
          onClick={() => setShowQueue(false)}
          className="w-full flex items-center justify-between p-4 border-b text-sm font-semibold text-brand-charcoal dark:text-foreground"
        >
          <span>Up Next ({stories.length} stories)</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="max-h-80 overflow-y-auto divide-y">
          {stories.map((story, idx) => {
            const hasClip = !!findClip(story.id);
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={story.id}
                onClick={() => skipTo(idx)}
                className={`w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50 ${
                  isCurrent ? "bg-brand-green/5 dark:bg-brand-green/10" : ""
                }`}
              >
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isCurrent && isPlaying
                    ? "bg-brand-green text-white"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {isCurrent && isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-bold">{idx + 1}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${
                    isCurrent ? "text-brand-green" : "text-brand-charcoal dark:text-foreground"
                  }`}>
                    {story.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {story.series && <span>{story.series}</span>}
                    {story.duration_seconds && (
                      <span>{Math.ceil(story.duration_seconds / 60)} min</span>
                    )}
                  </div>
                </div>
                {hasClip && (
                  <CheckCircle2 className="h-4 w-4 text-brand-green shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
