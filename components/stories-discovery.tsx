"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { StoryArt } from "@/components/twilight-ui";
import { Check, Plus, BookOpen, Clock, Sparkles, ChevronLeft, ChevronRight, Library, X } from "lucide-react";

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
  synopsis: string | null;
}

const STORAGE_KEY = "vox_selected_stories";

function getArtKind(c: Story) {
  if (!c) return "moon";
  const t = c.title.toLowerCase();
  if (t.includes("moon")) return "moon";
  if (t.includes("owl")) return "owl";
  if (t.includes("snow")) return "snow";
  if (t.includes("earth")) return "forest";
  if (t.includes("river")) return "river";
  if (t.includes("star")) return "stars";
  if (t.includes("cloud")) return "cloud";
  return "lantern";
}

function getColor(c: Story) {
  const hash = c.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = ["#E8856C", "#F4B860", "#7FC4A4", "#C58FB8", "#A3A7C9"];
  return colors[hash % colors.length];
}

export function StoriesDiscovery({ stories }: { stories: Story[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [centerIndex, setCenterIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [justSelected, setJustSelected] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Responsive: detect small screens
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load selected stories from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedIds(JSON.parse(stored));
    } catch {}
  }, []);

  // Save selected stories to localStorage
  const saveSelection = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    // Dispatch event so Library page can react
    window.dispatchEvent(new CustomEvent("stories-selection-changed", { detail: ids }));
  }, []);

  const toggleStory = (id: string) => {
    const isSelected = selectedIds.includes(id);
    if (isSelected) {
      saveSelection(selectedIds.filter(s => s !== id));
    } else {
      saveSelection([...selectedIds, id]);
      setJustSelected(id);
      setTimeout(() => setJustSelected(null), 800);
    }
  };

  const goTo = (index: number) => {
    const wrapped = ((index % stories.length) + stories.length) % stories.length;
    setCenterIndex(wrapped);
  };

  // Drag/swipe handling
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragOffset(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setDragOffset(e.clientX - dragStartX);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (Math.abs(dragOffset) > (isMobile ? 30 : 60)) {
      goTo(centerIndex + (dragOffset < 0 ? 1 : -1));
    }
    setDragOffset(0);
  };

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goTo(centerIndex - 1);
      if (e.key === "ArrowRight") goTo(centerIndex + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [centerIndex, stories.length]);

  const selectedStories = stories.filter(s => selectedIds.includes(s.id));
  const currentStory = stories[centerIndex];

  if (stories.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "var(--paper-dim)", padding: "80px 0" }}>
        <BookOpen size={48} style={{ color: "var(--ink-3)", marginBottom: 16 }} />
        <div className="serif" style={{ fontSize: 22 }}>No stories available yet.</div>
        <p style={{ fontSize: 14, color: "var(--paper-mute)", marginTop: 8 }}>Check back soon for new bedtime tales.</p>
      </div>
    );
  }

  // Responsive visible range: 3 cards on mobile, 5 on desktop
  const visibleRange = isMobile ? 1 : 2;

  return (
    <div>
      {/* 3D Carousel */}
      <div
        ref={carouselRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          position: "relative",
          height: isMobile ? 420 : 520,
          perspective: isMobile ? 800 : 1200,
          perspectiveOrigin: "50% 45%",
          marginBottom: isMobile ? 32 : 48,
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
          touchAction: "none",
          overflow: "hidden",
        }}
        className="fadeUp"
      >
        {/* Ambient glow behind center card */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 360,
          height: 420,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${getColor(currentStory)}22 0%, transparent 70%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
          transition: "background 0.6s ease",
        }} />

        {/* Cards */}
        <div style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
        }}>
          {stories.map((story, idx) => {
            const offset = idx - centerIndex;
            // Wrap around for circular carousel
            let adjustedOffset = offset;
            if (offset > stories.length / 2) adjustedOffset = offset - stories.length;
            if (offset < -stories.length / 2) adjustedOffset = offset + stories.length;

            const isCenter = adjustedOffset === 0;
            const isVisible = Math.abs(adjustedOffset) <= visibleRange;

            if (!isVisible) return null;

            const cardSpacing = isMobile ? 200 : 280;
            const translateX = adjustedOffset * cardSpacing + (isDragging ? dragOffset * 0.3 : 0);
            const translateZ = isCenter ? 0 : (isMobile ? -80 : -120) * Math.abs(adjustedOffset);
            const rotateY = adjustedOffset * (isMobile ? -12 : -18);
            const scale = isCenter ? 1 : Math.max(0.7, 1 - Math.abs(adjustedOffset) * 0.15);
            const opacity = isCenter ? 1 : Math.max(0.3, 1 - Math.abs(adjustedOffset) * 0.3);
            const zIndex = 100 - Math.abs(adjustedOffset) * 10;

            const isSelected = selectedIds.includes(story.id);
            const wasJustSelected = justSelected === story.id;

            return (
              <div
                key={story.id}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: isMobile ? 240 : 300,
                  marginLeft: isMobile ? -120 : -150,
                  marginTop: isMobile ? -180 : -220,
                  transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity,
                  zIndex,
                  transition: isDragging ? "none" : "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                  transformStyle: "preserve-3d",
                  pointerEvents: isCenter ? "auto" : "none",
                }}
              >
                <div
                  onClick={() => { if (!isCenter) return; }}
                  style={{
                    background: "var(--ink-1)",
                    border: isSelected
                      ? "2px solid rgba(244,184,96,0.6)"
                      : "1px solid var(--ink-3)",
                    borderRadius: 24,
                    overflow: "hidden",
                    boxShadow: isSelected
                      ? "0 0 30px rgba(244,184,96,0.15), 0 20px 60px rgba(0,0,0,0.4)"
                      : isCenter
                        ? "0 20px 60px rgba(0,0,0,0.5)"
                        : "0 10px 30px rgba(0,0,0,0.3)",
                    transition: "border-color 0.3s ease, box-shadow 0.3s ease",
                    position: "relative",
                  }}
                >
                  {/* Selected checkmark overlay */}
                  {isSelected && (
                    <div style={{
                      position: "absolute",
                      top: 14,
                      right: 14,
                      zIndex: 10,
                      width: 32,
                      height: 32,
                      borderRadius: 99,
                      background: "var(--lamp)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 12px rgba(244,184,96,0.4)",
                      animation: wasJustSelected ? "popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
                    }}>
                      <Check size={18} style={{ color: "var(--ink-0)" }} strokeWidth={3} />
                    </div>
                  )}

                  {/* Story Art */}
                  <div style={{ position: "relative" }}>
                    <StoryArt kind={getArtKind(story)} color={getColor(story)} height={200} />
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(180deg, transparent 50%, rgba(10,14,31,0.9) 100%)",
                    }} />
                    {story.is_premium && (
                      <div className="mono" style={{
                        position: "absolute",
                        top: 14,
                        left: 14,
                        background: "rgba(244,184,96,0.15)",
                        border: "1px solid rgba(244,184,96,0.3)",
                        color: "var(--lamp-soft)",
                        padding: "3px 10px",
                        borderRadius: 99,
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                      }}>
                        Premium
                      </div>
                    )}
                    <div style={{ position: "absolute", bottom: 16, left: 18, right: 18 }}>
                      <div className="mono" style={{
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--lamp-soft)",
                        marginBottom: 6,
                      }}>
                        {story.series || "Standalone"} {story.episode_number ? `· Ep ${story.episode_number}` : ""}
                      </div>
                    </div>
                  </div>

                  {/* Card Info */}
                  <div style={{ padding: "18px 20px 22px" }}>
                    <h3 className="serif" style={{
                      fontSize: 22,
                      lineHeight: 1.15,
                      margin: "0 0 14px 0",
                      color: "var(--paper)",
                      letterSpacing: "-0.01em",
                    }}>
                      {story.title}
                    </h3>

                    <div style={{ display: "flex", gap: 8, marginBottom: 18, fontSize: 11, color: "var(--paper-mute)" }}>
                      {story.duration_seconds && (
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: 99,
                          background: "rgba(244,236,219,0.04)",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}>
                          <Clock size={11} /> {Math.ceil(story.duration_seconds / 60)} min
                        </span>
                      )}
                      {story.age_range && (
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: 99,
                          background: "rgba(244,236,219,0.04)",
                        }}>
                          Ages {story.age_range}
                        </span>
                      )}
                    </div>

                    {/* Add/Remove Button */}
                    {isCenter && (
                      <button
                        onClick={() => toggleStory(story.id)}
                        style={{
                          width: "100%",
                          padding: "13px 0",
                          borderRadius: 14,
                          border: isSelected
                            ? "1px solid rgba(127,196,164,0.3)"
                            : "1px solid rgba(244,184,96,0.4)",
                          background: isSelected
                            ? "rgba(127,196,164,0.08)"
                            : "linear-gradient(135deg, var(--lamp), #E8856C)",
                          color: isSelected ? "var(--moss)" : "var(--ink-0)",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          transition: "all 0.25s ease",
                        }}
                      >
                        {isSelected ? (
                          <>
                            <Check size={16} /> In Your Library
                          </>
                        ) : (
                          <>
                            <Plus size={16} /> Add to Library
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={() => goTo(centerIndex - 1)}
          style={{
            position: "absolute",
            left: 20,
            top: "50%",
            transform: "translateY(-50%)",
            width: 52,
            height: 52,
            borderRadius: 99,
            background: "rgba(15,21,48,0.8)",
            border: "1px solid var(--ink-3)",
            color: "var(--paper-dim)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(8px)",
            zIndex: 200,
            transition: "all 0.2s",
          }}
        >
          <ChevronLeft size={22} />
        </button>
        <button
          onClick={() => goTo(centerIndex + 1)}
          style={{
            position: "absolute",
            right: 20,
            top: "50%",
            transform: "translateY(-50%)",
            width: 52,
            height: 52,
            borderRadius: 99,
            background: "rgba(15,21,48,0.8)",
            border: "1px solid var(--ink-3)",
            color: "var(--paper-dim)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(8px)",
            zIndex: 200,
            transition: "all 0.2s",
          }}
        >
          <ChevronRight size={22} />
        </button>

        {/* Dot Indicators */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          zIndex: 200,
        }}>
          {stories.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === centerIndex ? 24 : 8,
                height: 8,
                borderRadius: 99,
                border: "none",
                background: i === centerIndex ? "var(--lamp)" : "var(--ink-3)",
                cursor: "pointer",
                transition: "all 0.3s ease",
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* Story Detail Banner for Center Card */}
      {currentStory && (
        <div className="fadeUp" style={{
          background: "var(--ink-1)",
          border: "1px solid var(--ink-3)",
          borderRadius: 24,
          padding: "32px 36px",
          marginBottom: 48,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 24,
        }}>
          <div>
            <div className="mono" style={{
              fontSize: 10,
              color: "var(--lamp)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 8,
            }}>
              {currentStory.series || "Standalone"} {currentStory.episode_number ? `· Episode ${currentStory.episode_number}` : ""}
            </div>
            <h2 className="serif" style={{ fontSize: 32, margin: 0, color: "var(--paper)", letterSpacing: "-0.02em" }}>
              {currentStory.title}
            </h2>
            <p style={{ color: "var(--paper-dim)", marginTop: 8, fontSize: 14, lineHeight: 1.5, maxWidth: 600 }}>
              {currentStory.synopsis || "Swipe through the cards above to discover stories. Add your favorites to your library, then head over to listen."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => toggleStory(currentStory.id)}
              style={{
                padding: "14px 24px",
                borderRadius: 99,
                border: selectedIds.includes(currentStory.id)
                  ? "1px solid rgba(127,196,164,0.3)"
                  : "none",
                background: selectedIds.includes(currentStory.id)
                  ? "rgba(127,196,164,0.08)"
                  : "var(--lamp)",
                color: selectedIds.includes(currentStory.id)
                  ? "var(--moss)"
                  : "var(--ink-0)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
            >
              {selectedIds.includes(currentStory.id) ? <><Check size={16} /> In Library</> : <><Plus size={16} /> Add to Library</>}
            </button>
            <Link href="/browse" style={{
              padding: "14px 24px",
              borderRadius: 99,
              border: "1px solid var(--ink-3)",
              background: "transparent",
              color: "var(--paper)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
              transition: "all 0.2s",
            }}>
              <Library size={16} /> Go to Library
            </Link>
          </div>
        </div>
      )}

      {/* Your Selections Strip */}
      <div className="fadeUp" style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Sparkles size={18} style={{ color: "var(--lamp)" }} />
            <h3 className="serif" style={{ fontSize: 22, margin: 0, color: "var(--paper)" }}>
              Your Selections
            </h3>
            {selectedStories.length > 0 && (
              <span className="mono" style={{
                fontSize: 11,
                background: "rgba(244,184,96,0.1)",
                color: "var(--lamp-soft)",
                padding: "4px 12px",
                borderRadius: 99,
                border: "1px solid rgba(244,184,96,0.2)",
              }}>
                {selectedStories.length} {selectedStories.length === 1 ? "story" : "stories"}
              </span>
            )}
          </div>
          {selectedStories.length > 0 && (
            <Link href="/browse" className="mono" style={{
              fontSize: 12,
              color: "var(--lamp-soft)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              letterSpacing: "0.05em",
            }}>
              Open Library →
            </Link>
          )}
        </div>

        {selectedStories.length > 0 ? (
          <div style={{
            display: "flex",
            gap: 16,
            overflowX: "auto",
            paddingBottom: 8,
          }}>
            {selectedStories.map(story => (
              <div key={story.id} style={{
                flexShrink: 0,
                width: 180,
                background: "var(--ink-2)",
                border: "1px solid var(--ink-3)",
                borderRadius: 16,
                overflow: "hidden",
                position: "relative",
                transition: "transform 0.2s",
              }}>
                <button
                  onClick={() => toggleStory(story.id)}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    zIndex: 5,
                    width: 24,
                    height: 24,
                    borderRadius: 99,
                    background: "rgba(0,0,0,0.6)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "var(--paper-mute)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    backdropFilter: "blur(4px)",
                  }}
                  title="Remove from selections"
                >
                  <X size={12} />
                </button>
                <StoryArt kind={getArtKind(story)} color={getColor(story)} height={100} />
                <div style={{ padding: "10px 12px" }}>
                  <div className="serif" style={{
                    fontSize: 14,
                    color: "var(--paper)",
                    lineHeight: 1.2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {story.title}
                  </div>
                  <div className="mono" style={{ fontSize: 9, color: "var(--paper-mute)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {story.duration_seconds ? `${Math.ceil(story.duration_seconds / 60)} min` : "Story"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: "40px",
            border: "1px dashed var(--ink-3)",
            borderRadius: 20,
            textAlign: "center",
            color: "var(--paper-mute)",
          }}>
            <BookOpen size={32} style={{ color: "var(--ink-3)", marginBottom: 12 }} />
            <div style={{ fontSize: 14 }}>No stories selected yet</div>
            <div style={{ fontSize: 12, marginTop: 4, color: "var(--paper-dim)" }}>
              Spin the carousel above and tap <strong style={{ color: "var(--lamp)" }}>Add to Library</strong> on stories you love.
            </div>
          </div>
        )}
      </div>

      {/* All Stories Quick-Select Grid */}
      <div className="fadeUp">
        <div style={{ marginBottom: 20 }}>
          <h3 className="serif" style={{ fontSize: 22, margin: 0, color: "var(--paper)" }}>
            All Stories
          </h3>
          <p style={{ fontSize: 13, color: "var(--paper-dim)", marginTop: 4 }}>
            Quickly add or remove stories from your library.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))",
          gap: isMobile ? 12 : 16,
        }}>
          {stories.map(story => {
            const isSelected = selectedIds.includes(story.id);
            return (
              <button
                key={story.id}
                onClick={() => toggleStory(story.id)}
                style={{
                  background: isSelected ? "rgba(244,184,96,0.04)" : "var(--ink-2)",
                  border: isSelected
                    ? "1px solid rgba(244,184,96,0.3)"
                    : "1px solid var(--ink-3)",
                  borderRadius: 16,
                  padding: 0,
                  overflow: "hidden",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  transition: "all 0.2s ease",
                  position: "relative",
                }}
              >
                <div style={{ width: 80, height: 80, flexShrink: 0, position: "relative" }}>
                  <StoryArt kind={getArtKind(story)} color={getColor(story)} height={80} />
                  {isSelected && (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(244,184,96,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Check size={20} style={{ color: "var(--lamp)" }} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div style={{ padding: "12px 16px", flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: isSelected ? "var(--lamp)" : "var(--paper)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    transition: "color 0.2s",
                  }}>
                    {story.title}
                  </div>
                  <div className="mono" style={{
                    fontSize: 10,
                    color: "var(--paper-mute)",
                    marginTop: 4,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}>
                    {story.series || "Standalone"} · {story.duration_seconds ? `${Math.ceil(story.duration_seconds / 60)} min` : "Story"}
                  </div>
                </div>
                <div style={{ padding: "0 16px", flexShrink: 0 }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 99,
                    background: isSelected ? "var(--lamp)" : "transparent",
                    border: isSelected ? "none" : "1.5px solid var(--ink-3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s",
                  }}>
                    {isSelected && <Check size={14} style={{ color: "var(--ink-0)" }} strokeWidth={3} />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CSS animations */}
      <style jsx global>{`
        @keyframes popIn {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.3); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
