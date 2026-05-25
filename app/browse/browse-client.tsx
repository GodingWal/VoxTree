"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { TwilightShell } from "@/components/twilight-layout";
import { StoryArt, Waveform } from "@/components/twilight-ui";
import { Film, BookOpen, Clock, Sparkles, Trash2, Play, X, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";

interface ContentItem {
  id: string;
  title: string;
  series: string | null;
  episode_number: number | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  age_range: string | null;
  tags: string[];
  is_premium: boolean;
  content_type: string;
  synopsis: string | null;
}

interface Voice {
  id: string;
  name: string;
  status: string;
  relation?: string | null;
}

interface ProgressEntry {
  content_id: string;
  progress_seconds: number;
  completed: boolean;
}

const STORAGE_KEY = "vox_selected_stories";
const STARTER_INIT_KEY = "vox_starter_initialized";
const PROGRESS_KEY = "vox_story_progress";

function getArtKind(c: ContentItem) {
  if (c.title.toLowerCase().includes("moon")) return "moon";
  if (c.title.toLowerCase().includes("owl")) return "owl";
  if (c.title.toLowerCase().includes("snow")) return "snow";
  if (c.title.toLowerCase().includes("earth")) return "forest";
  if (c.title.toLowerCase().includes("river")) return "river";
  if (c.title.toLowerCase().includes("star")) return "stars";
  if (c.title.toLowerCase().includes("cloud")) return "cloud";
  return "lantern";
}

function getColor(c: ContentItem) {
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

export function BrowseClient({ initialStories, voices = [] }: { initialStories: ContentItem[]; voices?: Voice[] }) {
  const [activeTab, setActiveTab] = useState<"stories" | "videos">("stories");
  const [filter, setFilter] = useState<"all" | "goodnight" | "earth" | "short">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [playingStory, setPlayingStory] = useState<ContentItem | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, ProgressEntry>>({});

  // Load selected story IDs from localStorage (with auto-select for new users)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSelectedIds(JSON.parse(stored));
      } else if (!localStorage.getItem(STARTER_INIT_KEY) && initialStories.length > 0) {
        const starterIds = initialStories.slice(0, 3).map(s => s.id);
        setSelectedIds(starterIds);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(starterIds));
        localStorage.setItem(STARTER_INIT_KEY, "1");
        window.dispatchEvent(new CustomEvent("stories-selection-changed", { detail: starterIds }));
      }
    } catch {}

    // Load progress data
    try {
      const stored = localStorage.getItem(PROGRESS_KEY);
      if (stored) setProgressMap(JSON.parse(stored));
    } catch {}

    const handleChange = (e: any) => {
      setSelectedIds(e.detail || []);
    };
    window.addEventListener("stories-selection-changed", handleChange);
    return () => window.removeEventListener("stories-selection-changed", handleChange);
  }, [initialStories]);

  // Persist selections to Supabase (fire-and-forget)
  const syncSelectionsToSupabase = useCallback(async (ids: string[]) => {
    try {
      await fetch("/api/library/selections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyIds: ids }),
      });
    } catch {}
  }, []);

  const removeFromLibrary = (id: string) => {
    const newIds = selectedIds.filter(s => s !== id);
    setSelectedIds(newIds);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newIds));
    syncSelectionsToSupabase(newIds);
  };

  const updateProgress = useCallback((contentId: string, seconds: number, completed: boolean) => {
    setProgressMap(prev => {
      const updated = { ...prev, [contentId]: { content_id: contentId, progress_seconds: seconds, completed } };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(updated));
      // Sync to Supabase
      fetch("/api/library/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, progressSeconds: Math.floor(seconds), completed }),
      }).catch(() => {});
      return updated;
    });
  }, []);

  const openPlayer = (story: ContentItem) => {
    setPlayingStory(story);
  };

  const libraryStories = initialStories.filter(s => selectedIds.includes(s.id));

  const filteredStories = libraryStories.filter(s => {
    if (filter === "goodnight") return s.series === "Goodnight Tales";
    if (filter === "earth") return s.series === "Earth Songs";
    if (filter === "short") return s.duration_seconds ? s.duration_seconds < 600 : false;
    return true;
  });

  const mockVideos = [
    { id: "v1", title: "The Moon Who Forgot to Sleep \u2014 Animated Ep.", series: "Goodnight Tales", duration_seconds: 720, age_range: "3-6", desc: "Watch the stars gather to sing a drowsy moon back to bed in a watercolor environment." },
    { id: "v2", title: "What the Owl Said at Midnight \u2014 Animated Ep.", series: "Earth Songs", duration_seconds: 480, age_range: "4-7", desc: "Follow the midnight owl across glowing forests as it shares secrets with small hedgehogs." },
    { id: "v3", title: "The Quiet Color of Snow \u2014 Animated Ep.", series: "Goodnight Tales", duration_seconds: 900, age_range: "3-6", desc: "Witness winter\u2019s quiet colors fall softly across small cabins in a paper-crafted animation style." }
  ];

  return (
    <TwilightShell>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 80px" }}>

        {/* Header Section */}
        <div className="fadeUp" style={{ marginBottom: 40 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
            Your Library
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0, letterSpacing: "-0.02em", maxWidth: 900 }}>
            {activeTab === "stories"
              ? <>{libraryStories.length > 0 ? `${libraryStories.length} ${libraryStories.length === 1 ? 'story' : 'stories'}` : "Your stories"},<br/><span className="serif-italic" style={{ color: "var(--lamp)" }}>curated just for you.</span></>
              : <>{mockVideos.length} animated worlds,<br/><span className="serif-italic" style={{ color: "var(--lamp)" }}>bringing bedtime illustrations to life.</span></>
            }
          </h1>
        </div>

        {/* Stories / Videos Tab Switcher */}
        <div style={{
          display: "inline-flex",
          background: "var(--ink-2)",
          border: "1px solid var(--ink-3)",
          borderRadius: 99,
          padding: 4,
          marginBottom: 36,
          gap: 4
        }} className="fadeUp">
          <button
            onClick={() => setActiveTab("stories")}
            style={{
              padding: "10px 20px",
              borderRadius: 99,
              border: "none",
              background: activeTab === "stories" ? "var(--lamp)" : "transparent",
              color: activeTab === "stories" ? "var(--ink-0)" : "var(--paper-dim)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s"
            }}
          >
            <BookOpen size={16} />
            Stories
            {libraryStories.length > 0 && (
              <span style={{
                background: activeTab === "stories" ? "rgba(0,0,0,0.15)" : "rgba(244,184,96,0.15)",
                padding: "2px 8px",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
              }}>
                {libraryStories.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("videos")}
            style={{
              padding: "10px 20px",
              borderRadius: 99,
              border: "none",
              background: activeTab === "videos" ? "var(--lamp)" : "transparent",
              color: activeTab === "videos" ? "var(--ink-0)" : "var(--paper-dim)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s"
            }}
          >
            <Film size={16} />
            Videos
            <span className="mono" style={{
              fontSize: 9,
              background: activeTab === "videos" ? "rgba(0,0,0,0.15)" : "rgba(244,184,96,0.1)",
              padding: "2px 8px",
              borderRadius: 99,
              fontWeight: 600,
            }}>
              SOON
            </span>
          </button>
        </div>

        {activeTab === "stories" ? (
          <div className="fadeUp">
            {libraryStories.length > 0 ? (
              <>
                {/* Filter Buttons */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32, alignItems: "center" }}>
                  <button
                    onClick={() => setFilter("all")}
                    style={{
                      padding: "9px 16px",
                      background: filter === "all" ? "var(--paper)" : "transparent",
                      color: filter === "all" ? "var(--ink-0)" : "var(--paper-dim)",
                      border: `1px solid ${filter === "all" ? "var(--paper)" : "var(--ink-3)"}`,
                      borderRadius: 99, fontSize: 13, fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilter("goodnight")}
                    style={{
                      padding: "9px 16px",
                      background: filter === "goodnight" ? "var(--paper)" : "transparent",
                      color: filter === "goodnight" ? "var(--ink-0)" : "var(--paper-dim)",
                      border: `1px solid ${filter === "goodnight" ? "var(--paper)" : "var(--ink-3)"}`,
                      borderRadius: 99, fontSize: 13, fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    Goodnight Tales
                  </button>
                  <button
                    onClick={() => setFilter("earth")}
                    style={{
                      padding: "9px 16px",
                      background: filter === "earth" ? "var(--paper)" : "transparent",
                      color: filter === "earth" ? "var(--ink-0)" : "var(--paper-dim)",
                      border: `1px solid ${filter === "earth" ? "var(--paper)" : "var(--ink-3)"}`,
                      borderRadius: 99, fontSize: 13, fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    Earth Songs
                  </button>
                  <button
                    onClick={() => setFilter("short")}
                    style={{
                      padding: "9px 16px",
                      background: filter === "short" ? "var(--paper)" : "transparent",
                      color: filter === "short" ? "var(--ink-0)" : "var(--paper-dim)",
                      border: `1px solid ${filter === "short" ? "var(--paper)" : "var(--ink-3)"}`,
                      borderRadius: 99, fontSize: 13, fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    Under 10 min
                  </button>
                  <div style={{ flex: 1 }} />
                  <Link href="/dashboard/stories" className="mono" style={{
                    fontSize: 12,
                    color: "var(--lamp-soft)",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    letterSpacing: "0.05em",
                  }}>
                    <Sparkles size={12} /> Discover more stories
                  </Link>
                </div>

                {/* Featured Row */}
                {filteredStories.length > 0 && (
                  <FeaturedRow
                    story={filteredStories[0]}
                    onRemove={removeFromLibrary}
                    onPlay={openPlayer}
                    progress={progressMap[filteredStories[0].id]}
                  />
                )}

                {/* Stories Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20, marginTop: 40 }}>
                  {filteredStories.slice(1).map(s => (
                    <StoryCard
                      key={s.id}
                      story={s}
                      progress={progressMap[s.id]}
                      onRemove={removeFromLibrary}
                      onPlay={openPlayer}
                    />
                  ))}
                </div>
                {filteredStories.length === 0 && (
                  <div style={{ textAlign: "center", color: "var(--paper-mute)", padding: "80px 0" }}>
                    No stories match this filter.
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "80px 0" }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 99,
                  background: "rgba(244,184,96,0.06)", border: "1px solid rgba(244,184,96,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px",
                }}>
                  <BookOpen size={32} style={{ color: "var(--lamp-soft)" }} />
                </div>
                <h3 className="serif" style={{ fontSize: 28, color: "var(--paper)", margin: "0 0 12px 0" }}>
                  Your story shelf is empty
                </h3>
                <p style={{ fontSize: 15, color: "var(--paper-dim)", maxWidth: 440, margin: "0 auto 32px", lineHeight: 1.5 }}>
                  Head over to the Stories page to discover and select bedtime tales.
                  Once you add stories, they'll appear here ready to be narrated by your clones.
                </p>
                <Link href="/dashboard/stories" style={{
                  padding: "14px 28px", background: "var(--lamp)", color: "var(--ink-0)",
                  border: "none", borderRadius: 99, fontSize: 15, fontWeight: 600,
                  textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  <Sparkles size={16} /> Discover Stories
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="fadeUp">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Film size={18} style={{ color: "var(--lamp)" }} />
                <h2 className="serif" style={{ fontSize: 24, color: "var(--paper)", margin: 0 }}>Upcoming Widescreen Releases</h2>
              </div>
              <Link href="/videos" style={{ fontSize: 13, color: "var(--lamp-soft)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                Go to Videos Preview Studio <Sparkles size={12} />
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
              {mockVideos.map(v => (
                <div key={v.id} style={{ background: "var(--ink-2)", border: "1px solid var(--ink-3)", borderRadius: 24, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ width: "100%", aspectRatio: "16/9", background: "#080b18", position: "relative", overflow: "hidden" }}>
                    <img src="/mock_pixar_character.png" alt={v.title} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.35, filter: "blur(1px) grayscale(30%)" }} />
                    <div style={{ position: "absolute", top: 16, left: 16, background: "rgba(244,184,96,0.12)", border: "1px solid rgba(244,184,96,0.35)", color: "var(--lamp-soft)", padding: "4px 10px", borderRadius: 99, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Coming Soon</div>
                  </div>
                  <div style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
                    <div>
                      <div className="mono" style={{ fontSize: 9, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{v.series} · Ep {v.id === "v1" ? 14 : v.id === "v2" ? 3 : 15}</div>
                      <h3 className="serif" style={{ fontSize: 20, color: "var(--paper)", margin: "0 0 8px 0" }}>{v.title}</h3>
                      <p style={{ fontSize: 13, color: "var(--paper-dim)", margin: 0, lineHeight: 1.45 }}>{v.desc}</p>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
                      <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--paper-mute)" }}>
                        <span style={{ padding: "3px 8px", borderRadius: 99, background: "rgba(255,255,255,0.04)" }}>{Math.round(v.duration_seconds / 60)} min</span>
                        <span style={{ padding: "3px 8px", borderRadius: 99, background: "rgba(255,255,255,0.04)" }}>Ages {v.age_range}</span>
                      </div>
                      <Link href="/videos" style={{ background: "var(--lamp)", border: "none", color: "var(--ink-0)", padding: "8px 16px", borderRadius: 12, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Preview Studio</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inline Player Modal */}
      {playingStory && (
        <InlinePlayer
          story={playingStory}
          voices={voices}
          onClose={() => setPlayingStory(null)}
          onProgress={updateProgress}
          initialProgress={progressMap[playingStory.id]?.progress_seconds || 0}
        />
      )}
    </TwilightShell>
  );
}

/* ─── Story Card with Progress Bar ─── */
function StoryCard({ story, progress, onRemove, onPlay }: {
  story: ContentItem;
  progress?: ProgressEntry;
  onRemove: (id: string) => void;
  onPlay: (s: ContentItem) => void;
}) {
  const progressPct = progress && story.duration_seconds
    ? Math.min(100, Math.round((progress.progress_seconds / story.duration_seconds) * 100))
    : 0;

  return (
    <div style={{
      textAlign: "left", display: "block", width: "100%",
      background: "var(--ink-2)", border: "1px solid var(--ink-3)",
      borderRadius: 20, overflow: "hidden", padding: 0,
      transition: "transform .25s ease, border-color .2s",
      position: "relative",
    }}>
      {/* Remove button */}
      <button
        onClick={() => onRemove(story.id)}
        style={{
          position: "absolute", top: 12, right: 12, zIndex: 5,
          width: 30, height: 30, borderRadius: 99,
          background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.1)",
          color: "var(--paper-mute)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 0, backdropFilter: "blur(4px)",
        }}
        title="Remove from library"
      >
        <X size={14} />
      </button>

      <div onClick={() => onPlay(story)} style={{ cursor: "pointer" }}>
        <div style={{ position: "relative" }}>
          <StoryArt kind={getArtKind(story)} color={getColor(story)} height={170} />
          {/* Play overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: 0, transition: "opacity 0.2s",
          }} className="story-card-play-overlay">
            <div style={{ width: 48, height: 48, borderRadius: 99, background: "var(--lamp)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Play size={20} style={{ color: "var(--ink-0)", marginLeft: 2 }} />
            </div>
          </div>
        </div>
        <div style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", marginBottom: 8 }}>
            {story.series || "Standalone"} {story.episode_number ? `· Ep ${story.episode_number}` : ""}
          </div>
          <h3 className="serif" style={{ fontSize: 22, margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em", color: "var(--paper)" }}>
            {story.title}
          </h3>
          {story.synopsis && (
            <p style={{ fontSize: 13, color: "var(--paper-dim)", margin: "8px 0 0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {story.synopsis}
            </p>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 14, fontSize: 12, color: "var(--paper-dim)" }}>
            <span style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(244,236,219,0.06)" }}>
              {story.duration_seconds ? Math.ceil(story.duration_seconds / 60) : 10} min
            </span>
            {story.age_range && (
              <span style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(244,236,219,0.06)" }}>
                Ages {story.age_range}
              </span>
            )}
            {progress?.completed && (
              <span style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(127,196,164,0.1)", color: "var(--moss)" }}>
                Completed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {progressPct > 0 && !progress?.completed && (
        <div style={{ padding: "0 18px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 99, background: "var(--ink-3)", overflow: "hidden" }}>
              <div style={{ width: `${progressPct}%`, height: "100%", borderRadius: 99, background: "var(--lamp)", transition: "width 0.3s" }} />
            </div>
            <span className="mono" style={{ fontSize: 10, color: "var(--paper-mute)" }}>{progressPct}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Featured Row ─── */
function FeaturedRow({ story, onRemove, onPlay, progress }: {
  story: ContentItem;
  onRemove: (id: string) => void;
  onPlay: (s: ContentItem) => void;
  progress?: ProgressEntry;
}) {
  if (!story) return null;
  const progressPct = progress && story.duration_seconds
    ? Math.min(100, Math.round((progress.progress_seconds / story.duration_seconds) * 100))
    : 0;

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1.1fr 1fr",
      background: "var(--ink-1)", border: "1px solid var(--ink-3)",
      borderRadius: 28, overflow: "hidden", minHeight: 360,
      position: "relative",
    }} className="clones-dashboard-grid">
      <div style={{ position: "relative", minHeight: 200 }}>
        <StoryArt kind={getArtKind(story)} color={getColor(story)} height="100%" />
      </div>
      <div style={{ padding: "44px 44px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 14 }}>
          Featured {progress?.completed ? "· Completed" : progressPct > 0 ? `· ${progressPct}% listened` : ""}
        </div>
        <h2 className="serif" style={{ fontSize: 44, lineHeight: 1.05, margin: 0, letterSpacing: "-0.02em", color: "var(--paper)" }}>
          {story.title}
        </h2>
        <p style={{ marginTop: 16, color: "var(--paper-dim)", lineHeight: 1.6, maxWidth: 460, fontSize: 15 }}>
          {story.synopsis || "A gentle bedtime story waiting to be narrated by your family\u2019s voices."}
        </p>

        {/* Progress bar on featured */}
        {progressPct > 0 && !progress?.completed && (
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 5, borderRadius: 99, background: "var(--ink-3)", overflow: "hidden" }}>
              <div style={{ width: `${progressPct}%`, height: "100%", borderRadius: 99, background: "var(--lamp)", transition: "width 0.3s" }} />
            </div>
            <span className="mono" style={{ fontSize: 11, color: "var(--paper-mute)" }}>{progressPct}%</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 28, alignItems: "center" }}>
          <button onClick={() => onPlay(story)} style={{
            padding: "14px 22px", background: "var(--lamp)", color: "var(--ink-0)",
            border: 0, borderRadius: 99, fontWeight: 600, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}><Play size={16} /> {progressPct > 0 ? "Continue" : "Listen Now"}</button>
          <button onClick={() => onRemove(story.id)} style={{
            padding: "14px 22px", background: "transparent", color: "var(--paper)",
            border: "1px solid var(--ink-3)", borderRadius: 99, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}><Trash2 size={14} /> Remove</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Inline Player Modal ─── */
function InlinePlayer({ story, voices, onClose, onProgress, initialProgress }: {
  story: ContentItem;
  voices: Voice[];
  onClose: () => void;
  onProgress: (contentId: string, seconds: number, completed: boolean) => void;
  initialProgress: number;
}) {
  const [selectedVoice, setSelectedVoice] = useState(voices[0]?.id ?? "");
  const [playerState, setPlayerState] = useState<"idle" | "generating" | "ready" | "playing" | "paused">("idle");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(story.duration_seconds || 0);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  // Save progress periodically
  useEffect(() => {
    if (playerState === "playing" && progress > 0) {
      const completed = duration > 0 && progress >= duration - 2;
      onProgress(story.id, progress, completed);
    }
  }, [Math.floor(progress / 5)]); // Update every 5 seconds

  async function handleGenerate() {
    if (!selectedVoice) return;
    setError(null);
    setPlayerState("generating");

    try {
      const res = await fetch("/api/clips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: story.id, voiceId: selectedVoice }),
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
    const poll = setInterval(async () => {
      attempts++;
      if (attempts >= 60) {
        clearInterval(poll);
        setError("Generation is taking longer than expected.");
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
          setError("Generation failed.");
          setPlayerState("idle");
        }
      } catch {}
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
    if (initialProgress > 0 && initialProgress < (duration || Infinity)) {
      audio.currentTime = initialProgress;
    }
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("ended", () => {
      setPlayerState("ready");
      setProgress(0);
      onProgress(story.id, audio.duration, true);
      if (progressInterval.current) clearInterval(progressInterval.current);
    });
    audio.addEventListener("error", () => {
      setError("Failed to play audio.");
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
      const t = Math.max(0, Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + amount));
      audioRef.current.currentTime = t;
      setProgress(t);
    }
  }

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const isPlaying = playerState === "playing" || playerState === "generating";
  const activeColor = getColor(story);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(5,8,20,0.85)", backdropFilter: "blur(12px)",
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: "100%", maxWidth: 580,
        background: "var(--ink-1)", border: "1px solid var(--ink-3)",
        borderRadius: 32, padding: "36px 36px 32px",
        position: "relative",
        boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position: "absolute", top: 16, right: 16,
          width: 36, height: 36, borderRadius: 99,
          background: "var(--ink-2)", border: "1px solid var(--ink-3)",
          color: "var(--paper-mute)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <X size={18} />
        </button>

        {/* Story Info */}
        <div style={{ display: "flex", gap: 20, marginBottom: 28, alignItems: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: 16, overflow: "hidden", flexShrink: 0 }}>
            <StoryArt kind={getArtKind(story)} color={activeColor} height={80} />
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 4 }}>
              {story.series || "Standalone"} {story.episode_number ? `· Ep ${story.episode_number}` : ""}
            </div>
            <h3 className="serif" style={{ fontSize: 26, margin: 0, lineHeight: 1.1, color: "var(--paper)" }}>
              {story.title}
            </h3>
          </div>
        </div>

        {/* Waveform */}
        <div style={{
          background: "var(--ink-2)", border: `1px solid ${playerState === 'generating' ? 'var(--lamp-soft)' : 'var(--ink-3)'}`,
          borderRadius: 18, padding: "20px 24px",
          transition: "border-color 0.3s",
        }}>
          <div style={{ position: "relative" }}>
            <Waveform playing={isPlaying} count={48} height={56} color={activeColor} />
            <div style={{
              position: "absolute", top: 0, bottom: 0,
              left: `${progressPercent}%`,
              width: 2, background: "var(--lamp)",
              boxShadow: "0 0 12px var(--lamp)",
              transition: "left 0.2s linear",
            }} />
            {playerState === "generating" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,14,31,0.6)", borderRadius: 8 }}>
                <div className="mono" style={{ color: "var(--lamp)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>Generating...</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11, color: "var(--paper-mute)" }} className="mono">
            <span>{fmt(progress)}</span>
            <span>-{fmt(duration > 0 ? duration - progress : 0)}</span>
          </div>
        </div>

        {/* Transport Controls */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, marginTop: 28 }}>
          <button onClick={() => handleSeek(-15)} style={{ background: "transparent", border: 0, color: "var(--paper-mute)", cursor: "pointer", padding: 8 }}>
            <SkipBack size={20} />
          </button>
          <button onClick={handlePlayPause} disabled={!selectedVoice && voices.length > 0} style={{
            width: 64, height: 64, borderRadius: 99,
            background: "var(--lamp)", color: "var(--ink-0)",
            border: 0, cursor: "pointer", fontSize: 20,
            boxShadow: "0 0 0 5px rgba(244,184,96,0.15), 0 16px 40px -8px rgba(244,184,96,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {playerState === "playing" ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: 3 }} />}
          </button>
          <button onClick={() => handleSeek(15)} style={{ background: "transparent", border: 0, color: "var(--paper-mute)", cursor: "pointer", padding: 8 }}>
            <SkipForward size={20} />
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(255,100,100,0.08)", border: "1px solid rgba(255,100,100,0.2)", borderRadius: 12, color: "var(--rose)", fontSize: 12, textAlign: "center" }}>
            {error}
          </div>
        )}

        {/* Voice Selector */}
        {voices.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", marginBottom: 10 }}>
              <Volume2 size={11} style={{ marginRight: 6 }} />Narrator
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {voices.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVoice(v.id)}
                  style={{
                    padding: "8px 16px", borderRadius: 99,
                    background: selectedVoice === v.id ? "rgba(244,184,96,0.12)" : "var(--ink-2)",
                    border: `1px solid ${selectedVoice === v.id ? "rgba(244,184,96,0.4)" : "var(--ink-3)"}`,
                    color: selectedVoice === v.id ? "var(--lamp)" : "var(--paper-dim)",
                    fontSize: 13, fontWeight: 500, cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {v.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {voices.length === 0 && (
          <div style={{ marginTop: 24, textAlign: "center", padding: "16px", border: "1px dashed var(--ink-3)", borderRadius: 16, color: "var(--paper-mute)", fontSize: 13 }}>
            No voice clones ready. <Link href="/onboarding" style={{ color: "var(--lamp)", textDecoration: "none" }}>Add a clone →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
