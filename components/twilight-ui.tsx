"use client";

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MoreVertical, Trash2, Play, Square, Info } from 'lucide-react';
import { InteractiveClone } from '@/components/interactive-clone';


// Decorative story "art"
export function StoryArt({ kind, color, height = 180 }: { kind: string, color: string, height?: number | string }) {
  const C = color || "#3B5176";
  const common = { viewBox: "0 0 320 200", width: "100%", height, preserveAspectRatio: "xMidYMid slice" };

  const bg = (
    <>
      <defs>
        <linearGradient id={`g-${kind}-${C.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C} />
          <stop offset="1" stopColor="#0F1530" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#g-${kind}-${C.slice(1)})`} />
    </>
  );

  const scenes: Record<string, React.ReactNode> = {
    moon: (
      <>
        <circle cx="230" cy="70" r="38" fill="#F4ECDB" opacity="0.92" />
        <circle cx="218" cy="60" r="34" fill={C} opacity="0.45" />
        {Array.from({ length: 24 }).map((_, i) => (
          <circle key={i} cx={(i * 47) % 320} cy={(i * 29) % 130} r={i % 5 === 0 ? 1.5 : 0.9} fill="#F4ECDB" opacity={(i % 3) * 0.2 + 0.3} />
        ))}
        <path d="M0 200 Q80 160 160 175 T320 168 L320 200 Z" fill="#0A0E1F" opacity="0.7" />
      </>
    ),
    lantern: (
      <>
        <rect x="0" y="0" width="320" height="200" fill={C} opacity="0.15" />
        {[60, 130, 210, 280].map((x, i) => (
          <g key={i}>
            <line x1={x} y1="20" x2={x} y2="80" stroke="#F4ECDB" strokeWidth="1" opacity="0.3" />
            <ellipse cx={x} cy="100" rx="22" ry="28" fill="#F4B860" opacity={0.65 + (i % 2) * 0.2} />
            <ellipse cx={x} cy="100" rx="22" ry="28" fill="none" stroke="#F4ECDB" strokeWidth="1.5" opacity="0.7" />
          </g>
        ))}
        <path d="M0 200 Q80 160 160 175 T320 168 L320 200 Z" fill="#0A0E1F" opacity="0.5" />
      </>
    ),
    river: (
      <>
        {Array.from({ length: 9 }).map((_, i) => (
          <path key={i} d={`M0 ${60 + i * 14} Q80 ${50 + i * 14} 160 ${60 + i * 14} T320 ${60 + i * 14}`}
            stroke="#7FC4A4" strokeWidth="1.5" fill="none" opacity={0.15 + i * 0.07} />
        ))}
        <circle cx="60" cy="40" r="2" fill="#F4ECDB" opacity="0.8" />
        <circle cx="240" cy="28" r="1.5" fill="#F4ECDB" opacity="0.6" />
      </>
    ),
    stars: (
      <>
        {Array.from({ length: 60 }).map((_, i) => (
          <circle key={i}
            cx={((i * 53) % 320)} cy={((i * 31) % 180)}
            r={i % 7 === 0 ? 2 : i % 3 === 0 ? 1.2 : 0.7}
            fill="#F4ECDB" opacity={0.3 + (i % 4) * 0.18} />
        ))}
        <path d="M40 200 Q140 130 240 160 T320 150 L320 200 Z" fill="#0A0E1F" opacity="0.6" />
      </>
    ),
    forest: (
      <>
        {[20, 60, 100, 140, 180, 220, 260, 300].map((x, i) => (
          <path key={i} d={`M${x} 200 L${x - 24} 200 L${x} ${90 + (i % 3) * 20} L${x + 24} 200 Z`} fill="#0A0E1F" opacity={0.6 + (i % 3) * 0.15} />
        ))}
        <circle cx="80" cy="50" r="22" fill="#F4ECDB" opacity="0.85" />
      </>
    ),
    cloud: (
      <>
        <ellipse cx="100" cy="100" rx="60" ry="22" fill="#F4ECDB" opacity="0.5" />
        <ellipse cx="160" cy="90"  rx="50" ry="18" fill="#F4ECDB" opacity="0.7" />
        <ellipse cx="220" cy="105" rx="70" ry="24" fill="#F4ECDB" opacity="0.45" />
        <circle cx="270" cy="40" r="20" fill="#F4B860" opacity="0.8" />
      </>
    ),
    owl: (
      <>
        <circle cx="160" cy="105" r="48" fill="#F4ECDB" opacity="0.92" />
        <circle cx="142" cy="100" r="9" fill="#0A0E1F" />
        <circle cx="178" cy="100" r="9" fill="#0A0E1F" />
        <circle cx="142" cy="98"  r="3" fill="#F4B860" />
        <circle cx="178" cy="98"  r="3" fill="#F4B860" />
        <path d="M156 115 L160 122 L164 115 Z" fill="#F4B860" />
        {Array.from({ length: 40 }).map((_, i) => (
          <circle key={i} cx={(i * 37) % 320} cy={(i * 17) % 80} r={0.8} fill="#F4ECDB" opacity="0.5" />
        ))}
      </>
    ),
    snow: (
      <>
        {Array.from({ length: 50 }).map((_, i) => (
          <circle key={i} cx={(i * 41) % 320} cy={(i * 23) % 200} r={i % 5 === 0 ? 2 : 1.2} fill="#F4ECDB" opacity="0.7" />
        ))}
        <path d="M0 200 Q80 150 160 165 T320 160 L320 200 Z" fill="#F4ECDB" opacity="0.25" />
      </>
    ),
  };

  return (
    <svg {...common}>
      {bg}
      {scenes[kind] || scenes.moon}
    </svg>
  );
}

export function Waveform({ playing, count = 36, color = "var(--lamp)", height = 56 }: { playing: boolean, count?: number, color?: string, height?: number | string }) {
  const heights = useMemo(
    () => Array.from({ length: count }).map((_, i) => 0.35 + Math.abs(Math.sin(i * 1.7) * 0.55) + (i % 7 === 0 ? 0.2 : 0)),
    [count]
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height, width: "100%" }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          flex: 1,
          height: `${Math.min(1, h) * 100}%`,
          background: color,
          borderRadius: 99,
          transformOrigin: "center",
          animation: playing ? `barWave ${0.6 + (i % 5) * 0.18}s ease-in-out infinite` : "none",
          animationDelay: `${(i * 0.04) % 0.6}s`,
          opacity: playing ? 1 : 0.45,
        }} />
      ))}
    </div>
  );
}

export function Avatar({ name, color, size = 40, ring = false }: { name: string, color: string, size?: number, ring?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 99,
      background: `linear-gradient(135deg, ${color}, ${color}99)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--ink-0)", fontWeight: 600, fontSize: size * 0.36,
      boxShadow: ring ? `0 0 0 3px var(--ink-2), 0 0 0 4px ${color}55` : "none",
      flexShrink: 0,
    }}>
      {name.split(" ").map(s => s[0]).slice(0,2).join("")}
    </div>
  );
}

export function Pill({ children, subtle }: { children: React.ReactNode, subtle?: boolean }) {
  return (
    <span style={{
      padding: "3px 10px",
      borderRadius: 99,
      fontSize: 11,
      background: subtle ? "transparent" : "rgba(244,236,219,0.06)",
      border: subtle ? "1px solid var(--ink-3)" : "1px solid transparent",
      color: "var(--paper-dim)",
    }}>{children}</span>
  );
}

export function Section({ eyebrow, title, action, children }: { eyebrow?: React.ReactNode, title: React.ReactNode, action?: React.ReactNode, children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, gap: 16 }}>
        <div>
          {eyebrow && (
            <div className="mono" style={{
              fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--paper-mute)", marginBottom: 8,
            }}>{eyebrow}</div>
          )}
          <h2 className="serif" style={{ fontSize: 36, margin: 0, letterSpacing: "-0.02em" }}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TextLink({ children, onClick, href }: { children: React.ReactNode, onClick?: () => void, href?: string }) {
  const style = {
    background: "none", border: 0, padding: 0, cursor: "pointer",
    color: "var(--lamp-soft)", fontSize: 13, textDecoration: "none"
  };
  if (href) {
    return <a href={href} style={style}>{children}</a>;
  }
  return <button onClick={onClick} style={style}>{children}</button>;
}

export function CloneFullCard({ clone, href, onDelete }: { clone: any; href?: string; onDelete?: (id: string) => void }) {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const simulatedTimerRef = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(clone.avatar_url || null);

  useEffect(() => {
    if (!clone.avatar_url) {
      const simulated = localStorage.getItem(`sim_avatar_${clone.id}`);
      if (simulated) {
        setAvatarUrl(simulated);
      }
    }
  }, [clone.avatar_url, clone.id]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("clone-sample-state", {
        detail: { voiceId: clone.id, name: clone.name, playing },
      })
    );
  }, [playing, clone.id, clone.name]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showDropdown]);

  const ready = clone.status === "ready";

  const handlePlaySample = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (playing) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (simulatedTimerRef.current) {
        clearTimeout(simulatedTimerRef.current);
        simulatedTimerRef.current = null;
      }
      setPlaying(false);
      return;
    }

    setLoading(true);

    if (!clone.id.includes("-") || clone.id.startsWith("c") || clone.id.startsWith("mock")) {
      setLoading(false);
      setPlaying(true);
      if (simulatedTimerRef.current) clearTimeout(simulatedTimerRef.current);
      simulatedTimerRef.current = setTimeout(() => {
        setPlaying(false);
        simulatedTimerRef.current = null;
      }, 3000);
      return;
    }

    try {
      const res = await fetch("/api/voices/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: clone.id }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate voice sample");
      }

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.simulated) {
          alert("Simulation Mode: Testing voice requires an active ElevenLabs API Key. (Audio disabled, speaking simulated for 3 seconds)");
          setLoading(false);
          setPlaying(true);
          if (simulatedTimerRef.current) clearTimeout(simulatedTimerRef.current);
          simulatedTimerRef.current = setTimeout(() => {
            setPlaying(false);
            simulatedTimerRef.current = null;
          }, 3000);
          return;
        }
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onplay = () => {
        setPlaying(true);
        setLoading(false);
      };
      
      audio.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        setPlaying(false);
        setLoading(false);
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.error("Failed to play voice sample:", err);
      alert("Error playing sample voice. Please try again.");
      setPlaying(false);
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDropdown(false);

    const confirmDelete = window.confirm(`Are you sure you want to delete ${clone.name}? This action cannot be undone.`);
    if (!confirmDelete) return;

    // Simulated/mock ID handling
    if (!clone.id.includes("-") || clone.id.startsWith("c") || clone.id.startsWith("mock")) {
      setDeleting(true);
      setTimeout(() => {
        setDeleting(false);
        if (onDelete) {
          onDelete(clone.id);
        } else {
          alert(`${clone.name} deleted (simulated).`);
          router.refresh();
        }
      }, 800);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/voices/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: clone.id }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete clone");
      }

      if (onDelete) {
        onDelete(clone.id);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      console.error("Failed to delete voice:", err);
      alert(err.message || "Error deleting clone. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (href) {
      // Don't navigate if clicking on buttons or dropdown items
      if ((e.target as HTMLElement).closest('button')) {
        return;
      }
      router.push(href);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      style={{
        background: "#161b33",
        border: "1px solid rgba(244, 236, 219, 0.05)",
        borderRadius: 24,
        padding: 24,
        position: "relative",
        cursor: href ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
      className="group"
    >
      {/* Three-dots Options Dropdown */}
      <div 
        ref={dropdownRef} 
        style={{ position: "absolute", top: 16, right: 16, zIndex: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          style={{
            background: "rgba(10, 14, 31, 0.75)",
            border: "1px solid rgba(244, 236, 219, 0.1)",
            borderRadius: 99,
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--paper-dim)",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          className="hover:text-[var(--lamp)] hover:border-[var(--lamp)] active:scale-95"
          title="Options"
        >
          <MoreVertical size={16} />
        </button>

        {showDropdown && (
          <div
            style={{
              position: "absolute",
              top: 36,
              right: 0,
              background: "#1a2240",
              border: "1px solid var(--ink-3)",
              borderRadius: 12,
              padding: "6px 0",
              width: 160,
              boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
              display: "flex",
              flexDirection: "column",
              zIndex: 40,
            }}
            className="animate-slide-up"
          >
            {href && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDropdown(false);
                  router.push(href);
                }}
                style={{
                  padding: "8px 14px",
                  background: "transparent",
                  border: 0,
                  color: "var(--paper-dim)",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                className="hover:bg-white/5 hover:text-white"
              >
                <Info size={14} />
                <span>View Details</span>
              </button>
            )}
            
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDropdown(false);
                handlePlaySample(e);
              }}
              style={{
                padding: "8px 14px",
                background: "transparent",
                border: 0,
                color: "var(--paper-dim)",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              className="hover:bg-white/5 hover:text-white"
            >
              {playing ? <Square size={14} /> : <Play size={14} />}
              <span>{playing ? "Stop Sample" : "Hear Sample"}</span>
            </button>

            <button
              onClick={handleDelete}
              style={{
                padding: "8px 14px",
                background: "transparent",
                border: 0,
                color: "var(--rose)",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderTop: "1px solid var(--ink-3)",
                marginTop: 4,
                paddingTop: 8,
              }}
              className="hover:bg-red-500/10"
            >
              <Trash2 size={14} />
              <span>Delete Clone</span>
            </button>
          </div>
        )}
      </div>

      {deleting && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(10, 14, 31, 0.8)",
            backdropFilter: "blur(4px)",
            borderRadius: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            zIndex: 50,
          }}
        >
          <Loader2 className="h-6 w-6 animate-spin text-[var(--rose)]" />
          <span className="mono" style={{ fontSize: 11, color: "var(--rose)", letterSpacing: "0.05em" }}>DELETING...</span>
        </div>
      )}

      <InteractiveClone
        name={clone.name}
        avatarUrl={avatarUrl}
        modelUrl={clone.model_3d_url}
        speaking={playing}
      />

      {/* Meta Specs */}
      <div>
        <h3 className="serif" style={{ fontSize: 24, color: "var(--paper)", margin: 0, letterSpacing: "-0.01em", fontWeight: "bold" }}>
          {clone.name}
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <span className="mono" style={{ fontSize: 9, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            {clone.relation || 'Relative'}
          </span>
          <span style={{ color: "var(--paper-mute)", fontSize: 9 }}>•</span>
          <span className="mono" style={{ fontSize: 9, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            Cloned
          </span>
          <span style={{ color: "var(--paper-mute)", fontSize: 9 }}>•</span>
          {clone.status === "failed" ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, color: "#E8856C", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }} className="mono">
              <span style={{ width: 5, height: 5, borderRadius: 99, background: "#E8856C" }} />
              Failed
            </span>
          ) : clone.status === "processing" ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, color: "#F4B860", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }} className="mono">
              <span style={{ width: 5, height: 5, borderRadius: 99, background: "#F4B860" }} className="animate-pulse" />
              Processing
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, color: "#7FC4A4", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }} className="mono">
              <span style={{ width: 5, height: 5, borderRadius: 99, background: "#7FC4A4" }} />
              Active
            </span>
          )}
        </div>
      </div>

      {/* Play Button */}
      {clone.status === "failed" ? (
        <button 
          disabled
          style={{
            width: "100%",
            padding: "14px",
            background: "rgba(232, 133, 108, 0.08)",
            color: "#E8856C",
            border: "1px solid rgba(232, 133, 108, 0.2)",
            borderRadius: 16,
            fontSize: 14,
            fontWeight: 600,
            cursor: "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          ⚠️ Creation Failed
        </button>
      ) : clone.status === "processing" ? (
        <button 
          disabled
          style={{
            width: "100%",
            padding: "14px",
            background: "rgba(244, 184, 96, 0.08)",
            color: "#F4B860",
            border: "1px solid rgba(244, 184, 96, 0.2)",
            borderRadius: 16,
            fontSize: 14,
            fontWeight: 600,
            cursor: "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating Clone...
        </button>
      ) : (
        <button 
          onClick={handlePlaySample}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            background: "#f4b860",
            color: "#0a0e1f",
            border: "none",
            borderRadius: 16,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "transform 0.15s ease, opacity 0.15s ease",
          }}
          className="hover:opacity-90 active:scale-95"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : playing ? (
            "■ Stop Sample"
          ) : (
            <>
              <span style={{ fontSize: 10 }}>▶</span> Hear Sample
            </>
          )}
        </button>
      )}

      {/* Shared audio meter animation */}
      <style jsx global>{`
        @keyframes barWave {
          0% { height: 15%; }
          100% { height: 100%; }
        }
      `}</style>
    </div>
  );
}
