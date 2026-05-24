"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { StoryArt, Avatar, Waveform } from "@/components/twilight-ui";

interface Voice {
  id: string;
  name: string;
  status: string;
  relation?: string | null;
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

type PlayerState = "idle" | "generating" | "ready" | "playing" | "paused";

function getArtKind(c: Story) {
  if (!c) return "moon";
  if (c.title.toLowerCase().includes("moon")) return "moon";
  if (c.title.toLowerCase().includes("owl")) return "owl";
  if (c.title.toLowerCase().includes("snow")) return "snow";
  if (c.title.toLowerCase().includes("earth")) return "forest";
  if (c.title.toLowerCase().includes("river")) return "river";
  if (c.title.toLowerCase().includes("star")) return "stars";
  if (c.title.toLowerCase().includes("cloud")) return "cloud";
  return "lantern";
}

function getColor(c: Story) {
  if (!c) return "#3B5176";
  const hash = c.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = ["#E8856C", "#F4B860", "#7FC4A4", "#C58FB8", "#A3A7C9"];
  return colors[hash % colors.length];
}

function getVoiceColor(id: string) {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = ["#E8856C", "#F4B860", "#7FC4A4", "#C58FB8", "#A3A7C9"];
  return colors[hash % colors.length];
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

export function StoriesPlayer({ stories, voices, existingClips }: StoriesPlayerProps) {
  const [selectedVoice, setSelectedVoice] = useState<string>(voices[0]?.id ?? "");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const currentStory = stories[currentIndex];

  const findClip = useCallback(
    (storyId: string) =>
      existingClips.find(
        (c) => c.content_id === storyId && c.voice_id === selectedVoice && c.status === "ready"
      ),
    [existingClips, selectedVoice]
  );

  // Check for existing clip when story or voice changes
  useEffect(() => {
    if (!currentStory) return;
    const clip = findClip(currentStory.id);
    if (clip?.output_audio_url || clip?.output_video_url) {
      setClipUrl(clip.output_audio_url ?? clip.output_video_url);
      setPlayerState("ready");
    } else {
      setClipUrl(null);
      setPlayerState("idle");
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setProgress(0);
    setDuration(0);
  }, [currentIndex, selectedVoice, findClip, currentStory]);

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

  async function handleGenerateAndPlay() {
    if (!selectedVoice || !currentStory) return;
    setError(null);
    setPlayerState("generating");

    try {
      const res = await fetch("/api/clips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: currentStory.id,
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
        playAudio(data.videoUrl);
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
          playAudio(data.url);
        } else if (data.status === "failed") {
          clearInterval(poll);
          setError("Generation failed. Please try again.");
          setPlayerState("idle");
        }
      } catch {
        // Retry
      }
    }, 3000);
  }

  function playAudio(url: string) {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);
    });

    audio.addEventListener("ended", () => {
      setPlayerState("ready");
      setProgress(0);
      if (progressInterval.current) clearInterval(progressInterval.current);
      // Auto-advance
      if (currentIndex < stories.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setTimeout(() => {
           // Provide slight delay before next track
        }, 100);
      }
    });

    audio.play();
    setPlayerState("playing");
    startProgressTracking();
  }

  function handlePlayPause() {
    if (playerState === "idle" || playerState === "generating") {
      handleGenerateAndPlay();
      return;
    }

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

    playAudio(clipUrl);
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

  function handleSeek(amount: number) {
    if (audioRef.current) {
      const newTime = Math.max(0, Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + amount));
      audioRef.current.currentTime = newTime;
      setProgress(newTime);
    }
  }
  
  function skipTo(index: number) {
    if (index < 0 || index >= stories.length) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayerState("idle");
    setProgress(0);
    setDuration(0);
    setError(null);
    if (progressInterval.current) clearInterval(progressInterval.current);
    setCurrentIndex(index);
  }

  if (stories.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "var(--paper-dim)", marginTop: 40, padding: 40, border: "1px dashed var(--ink-3)", borderRadius: 16 }}>
        No stories available.
      </div>
    );
  }

  const activeVoice = voices.find((v) => v.id === selectedVoice);
  const activeColor = activeVoice ? getVoiceColor(activeVoice.id) : "var(--lamp)";
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const isPlaying = playerState === "playing" || playerState === "generating";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 56, alignItems: "start", paddingBottom: 100 }}>
      {/* LEFT COLUMN: Player & Controls */}
      <div>
        <div style={{ position: "relative", borderRadius: 28, overflow: "hidden", aspectRatio: "1/1", border: "1px solid var(--ink-3)", marginBottom: 32 }}>
          <StoryArt kind={getArtKind(currentStory)} color={getColor(currentStory)} height="100%" />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(10,14,31,0.85) 100%)" }} />
          <div style={{ position: "absolute", left: 32, right: 32, bottom: 32 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp-soft)", marginBottom: 12 }}>
              {currentStory.series || "Standalone"} {currentStory.episode_number ? `· Episode ${currentStory.episode_number}` : ""}
            </div>
            <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.05, margin: 0, letterSpacing: "-0.02em", color: "var(--paper)" }}>
              {currentStory.title}
            </h1>
          </div>
        </div>

        {/* Big waveform */}
        <div style={{ background: "var(--ink-2)", border: `1px solid ${playerState === 'generating' ? 'var(--lamp-soft)' : 'var(--ink-3)'}`, borderRadius: 22, padding: 24, transition: "border-color 0.3s ease" }}>
          <div style={{ position: "relative" }}>
            <Waveform playing={isPlaying} count={52} height={60} color={activeColor} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${progressPercent}%`, width: 2, background: "var(--lamp)", boxShadow: "0 0 12px var(--lamp)", transition: "left 0.2s linear" }} />
            {playerState === "generating" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,14,31,0.5)", borderRadius: 8 }}>
                <div className="mono" style={{ color: "var(--lamp)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Generating Audio...</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 12, color: "var(--paper-mute)" }} className="mono">
            <span>{fmt(progress)}</span>
            <span>−{fmt(duration > 0 ? duration - progress : 0)}</span>
          </div>
        </div>

        {/* Transport */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, marginTop: 32 }}>
          <button onClick={() => skipTo(currentIndex - 1)} disabled={currentIndex === 0} style={{ background: "transparent", border: 0, color: currentIndex === 0 ? "var(--ink-3)" : "var(--paper-mute)", cursor: currentIndex === 0 ? "not-allowed" : "pointer" }}>
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
          </button>
          
          <button onClick={() => handleSeek(-15)} style={{ background: "transparent", border: 0, color: "var(--paper-mute)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5V2L7 6l5 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /><text x="12" y="16" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none">15</text></svg>
          </button>
          
          <button onClick={handlePlayPause} disabled={!selectedVoice} style={{
            width: 72, height: 72, borderRadius: 99, background: "var(--lamp)", color: "var(--ink-0)", border: 0, cursor: !selectedVoice ? "not-allowed" : "pointer", fontSize: 22, fontWeight: 700,
            boxShadow: "0 0 0 6px rgba(244,184,96,0.18), 0 20px 50px -10px rgba(244,184,96,0.5)", opacity: !selectedVoice ? 0.5 : 1
          }}>
            {playerState === "playing" ? "❚❚" : "▸"}
          </button>
          
          <button onClick={() => handleSeek(15)} style={{ background: "transparent", border: 0, color: "var(--paper-mute)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" transform="scale(-1,1) translate(-24,0)"><path d="M12 5V2L7 6l5 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
          </button>

          <button onClick={() => skipTo(currentIndex + 1)} disabled={currentIndex >= stories.length - 1} style={{ background: "transparent", border: 0, color: currentIndex >= stories.length - 1 ? "var(--ink-3)" : "var(--paper-mute)", cursor: currentIndex >= stories.length - 1 ? "not-allowed" : "pointer" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)", borderRadius: 12, color: "var(--rose)", fontSize: 13, textAlign: "center" }}>
            {error}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Voices & Queue */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <div style={{ position: "relative" }}>
            {activeVoice ? (
              <Avatar name={activeVoice.name} color={activeColor} size={56} ring />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 99, background: "var(--ink-2)", border: "1px solid var(--ink-3)" }} />
            )}
            {isPlaying && (
              <div style={{ position: "absolute", inset: -4, borderRadius: 99, border: `2px solid ${activeColor}`, animation: "lampPulse 1.6s ease-in-out infinite", pointerEvents: "none" }} />
            )}
          </div>
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--paper-mute)", textTransform: "uppercase" }}>
              Narrated by
            </div>
            <div className="serif" style={{ fontSize: 24, lineHeight: 1.1, marginTop: 4, color: "var(--paper)" }}>
              {activeVoice ? activeVoice.name : "No Voice Selected"}
            </div>
          </div>
        </div>

        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--paper-mute)", marginBottom: 12 }}>
          Switch Voice
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 40 }}>
          {voices.map((v) => {
            const isSelected = selectedVoice === v.id;
            return (
              <button key={v.id} disabled={v.status !== "ready"} onClick={() => setSelectedVoice(v.id)} style={{
                background: isSelected ? "rgba(244,184,96,0.1)" : "var(--ink-2)",
                border: `1px solid ${isSelected ? "rgba(244,184,96,0.45)" : "var(--ink-3)"}`,
                borderRadius: 99, padding: "8px 16px 8px 8px", display: "flex", alignItems: "center", gap: 12,
                cursor: v.status === "ready" ? "pointer" : "not-allowed", color: "var(--paper)", opacity: v.status === "ready" ? 1 : 0.5,
              }}>
                <Avatar name={v.name} color={getVoiceColor(v.id)} size={28} />
                <div style={{ fontSize: 13, fontWeight: 500 }}>{v.name.split(" ")[0]}</div>
              </button>
            );
          })}
          {voices.length === 0 && (
            <div style={{ padding: 12, border: "1px dashed var(--ink-3)", borderRadius: 16, color: "var(--paper-mute)", fontSize: 13 }}>
              No voices ready. <Link href="/onboarding" style={{ color: "var(--lamp)", textDecoration: "none" }}>Add a voice →</Link>
            </div>
          )}
        </div>

        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--paper-mute)", marginBottom: 12 }}>
          Up Next
        </div>
        <div style={{ background: "var(--ink-1)", border: "1px solid var(--ink-3)", borderRadius: 20, overflow: "hidden" }}>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {stories.map((story, idx) => {
              const hasClip = !!findClip(story.id);
              const isCurrent = idx === currentIndex;
              return (
                <button key={story.id} onClick={() => skipTo(idx)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 16, padding: "16px",
                  background: isCurrent ? "rgba(244,236,219,0.03)" : "transparent",
                  borderBottom: "1px solid var(--ink-3)", textAlign: "left",
                  cursor: "pointer", border: "none", borderBottomColor: "var(--ink-3)"
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                    background: isCurrent && isPlaying ? "var(--lamp)" : "var(--ink-2)",
                    color: isCurrent && isPlaying ? "var(--ink-0)" : "var(--paper-mute)",
                    fontWeight: 600, fontSize: 12
                  }}>
                    {isCurrent && isPlaying ? "▸" : (idx + 1)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: isCurrent ? "var(--lamp)" : "var(--paper)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {story.title}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", marginTop: 4, letterSpacing: "0.05em" }}>
                      {story.duration_seconds ? `${Math.ceil(story.duration_seconds / 60)} min` : "Story"} {hasClip ? " • Ready" : ""}
                    </div>
                  </div>
                  {hasClip && (
                     <div style={{ width: 8, height: 8, borderRadius: 99, background: "var(--lamp)" }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
