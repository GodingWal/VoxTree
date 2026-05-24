"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { StoryArt, Avatar, Waveform } from "@/components/twilight-ui";

interface Voice {
  id: string;
  name: string;
  status: string;
  sample_audio_url?: string | null;
  relation?: string | null;
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

// Map content type/tags to an art kind
function getArtKind(c: Content) {
  if (c.title.toLowerCase().includes("moon")) return "moon";
  if (c.title.toLowerCase().includes("owl")) return "owl";
  if (c.title.toLowerCase().includes("snow")) return "snow";
  if (c.title.toLowerCase().includes("earth")) return "forest";
  if (c.title.toLowerCase().includes("river")) return "river";
  if (c.title.toLowerCase().includes("star")) return "stars";
  if (c.title.toLowerCase().includes("cloud")) return "cloud";
  return "lantern";
}

function getColor(c: Content) {
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

export function StoryPlayer({ content, voices, existingClips }: StoryPlayerProps) {
  const [selectedVoice, setSelectedVoice] = useState<string>(
    voices[0]?.id ?? ""
  );
  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
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
    if (playerState === "idle" || playerState === "generating") {
      handleGenerate();
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

    const audio = new Audio(clipUrl);
    audioRef.current = audio;

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

  function handleSeek(amount: number) {
    if (audioRef.current) {
      const newTime = Math.max(0, Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + amount));
      audioRef.current.currentTime = newTime;
      setProgress(newTime);
    }
  }

  const activeVoice = voices.find((v) => v.id === selectedVoice);
  const activeColor = activeVoice ? getVoiceColor(activeVoice.id) : "var(--lamp)";
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const isPlaying = playerState === "playing" || playerState === "generating";

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 24px" }}>
      <Link href="/browse" style={{
        background: "none", border: 0, color: "var(--paper-mute)",
        cursor: "pointer", marginBottom: 24, fontSize: 13, textDecoration: "none",
        display: "inline-block"
      }}>← Back to library</Link>

      <div style={{
        display: "grid", gridTemplateColumns: "1.1fr 1fr",
        gap: 56, alignItems: "start",
      }}>
        {/* Story art panel */}
        <div style={{
          position: "relative", borderRadius: 28, overflow: "hidden",
          aspectRatio: "5/6",
          border: "1px solid var(--ink-3)",
        }}>
          <StoryArt kind={getArtKind(content)} color={getColor(content)} height="100%" />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, transparent 40%, rgba(10,14,31,0.85) 100%)",
          }} />
          <div style={{ position: "absolute", left: 32, right: 32, bottom: 32 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp-soft)", marginBottom: 12 }}>
              {content.series || "Standalone"} {content.episode_number ? `· Episode ${content.episode_number}` : ""}
            </div>
            <h1 className="serif" style={{ fontSize: 48, lineHeight: 1.02, margin: 0, letterSpacing: "-0.02em", color: "var(--paper)" }}>
              {content.title}
            </h1>
          </div>
        </div>

        {/* Player panel */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ position: "relative" }}>
              {activeVoice ? (
                <Avatar name={activeVoice.name} color={activeColor} size={64} ring />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 99, background: "var(--ink-2)", border: "1px solid var(--ink-3)" }} />
              )}
              {isPlaying && (
                <div style={{
                  position: "absolute", inset: -6, borderRadius: 99,
                  border: `2px solid ${activeColor}`,
                  animation: "lampPulse 1.6s ease-in-out infinite",
                  pointerEvents: "none",
                }} />
              )}
            </div>
            <div>
              <div className="mono" style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--paper-mute)", textTransform: "uppercase" }}>
                Narrated by
              </div>
              <div className="serif" style={{ fontSize: 28, lineHeight: 1.1, marginTop: 4, color: "var(--paper)" }}>
                {activeVoice ? activeVoice.name : "No Voice Selected"}
              </div>
            </div>
          </div>

          {/* Big waveform */}
          <div style={{
            background: "var(--ink-2)", border: `1px solid ${playerState === 'generating' ? 'var(--lamp-soft)' : 'var(--ink-3)'}`,
            borderRadius: 22, padding: 24,
            transition: "border-color 0.3s ease"
          }}>
            <div style={{ position: "relative" }}>
              <Waveform playing={isPlaying} count={64} height={72} color={activeColor} />
              {/* playhead */}
              <div style={{
                position: "absolute", top: 0, bottom: 0,
                left: `${progressPercent}%`,
                width: 2, background: "var(--lamp)",
                boxShadow: "0 0 12px var(--lamp)",
                transition: "left 0.2s linear"
              }} />
              
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
            <button onClick={() => handleSeek(-15)} style={{
              background: "transparent", border: 0, color: "var(--paper-mute)", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 8
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5V2L7 6l5 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /><text x="12" y="16" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none">15</text></svg>
            </button>
            <button onClick={handlePlayPause} disabled={!selectedVoice} style={{
              width: 72, height: 72, borderRadius: 99,
              background: "var(--lamp)", color: "var(--ink-0)",
              border: 0, cursor: !selectedVoice ? "not-allowed" : "pointer", fontSize: 22, fontWeight: 700,
              boxShadow: "0 0 0 6px rgba(244,184,96,0.18), 0 20px 50px -10px rgba(244,184,96,0.5)",
              opacity: !selectedVoice ? 0.5 : 1
            }}>
              {playerState === "playing" ? "❚❚" : "▸"}
            </button>
            <button onClick={() => handleSeek(15)} style={{
              background: "transparent", border: 0, color: "var(--paper-mute)", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 8
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" transform="scale(-1,1) translate(-24,0)"><path d="M12 5V2L7 6l5 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
            </button>
          </div>

          {error && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)", borderRadius: 12, color: "var(--rose)", fontSize: 13, textAlign: "center" }}>
              {error}
            </div>
          )}

          {/* Clone switcher */}
          <div style={{ marginTop: 36 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--paper-mute)", marginBottom: 12 }}>
              Switch the narrator
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {voices.map((v) => {
                const isSelected = selectedVoice === v.id;
                return (
                  <button key={v.id}
                    disabled={v.status !== "ready"}
                    onClick={() => setSelectedVoice(v.id)}
                    style={{
                      background: isSelected ? "rgba(244,184,96,0.1)" : "var(--ink-2)",
                      border: `1px solid ${isSelected ? "rgba(244,184,96,0.45)" : "var(--ink-3)"}`,
                      borderRadius: 16, padding: 14,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                      cursor: v.status === "ready" ? "pointer" : "not-allowed",
                      color: "var(--paper)",
                      opacity: v.status === "ready" ? 1 : 0.5,
                    }}>
                    <Avatar name={v.name} color={getVoiceColor(v.id)} size={38} />
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{v.name.split(" ")[0]}</div>
                    <div className="mono" style={{ fontSize: 9, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {v.status === "ready" ? (v.relation || "Family") : "Training"}
                    </div>
                  </button>
                );
              })}
              {voices.length === 0 && (
                <div style={{ gridColumn: "1/-1", padding: 24, textAlign: "center", border: "1px dashed var(--ink-3)", borderRadius: 16, color: "var(--paper-mute)", fontSize: 13 }}>
                  No voices ready. <Link href="/onboarding" style={{ color: "var(--lamp)", textDecoration: "none" }}>Add a voice →</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
