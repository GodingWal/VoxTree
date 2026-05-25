"use client";

import React, { useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';


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

export function CloneFullCard({ clone, href }: { clone: any; href?: string }) {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ready = clone.status === "ready";

  const handlePlaySample = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }

    setLoading(true);
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
          alert("Simulation Mode: Testing voice requires an active ElevenLabs API Key. (Audio disabled)");
          setLoading(false);
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (href) {
      // Don't navigate if clicking on buttons
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
        background: "var(--ink-2)",
        border: `1px solid ${ready ? "var(--ink-3)" : "rgba(244,184,96,0.35)"}`,
        borderRadius: 20, padding: 22,
        position: "relative",
        cursor: href ? "pointer" : "default",
      }}
    >
      <Avatar name={clone.name} color={clone.color} size={56} ring />
      <div style={{ marginTop: 16 }}>
        <div className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>{clone.name}</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 6 }}>
          {clone.relation || 'Relative'} · added {clone.recorded || 'Recently'}
        </div>
      </div>
      <div style={{ margin: "18px 0" }}>
        <Waveform playing={playing} count={28} height={28} color={clone.color} />
      </div>
      {ready ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--paper-dim)" }}>
            <span>{clone.stories || 0} reads</span>
            <span>{clone.lastUsed || 'Never'}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button 
              onClick={handlePlaySample}
              disabled={loading}
              style={{
                flex: 1, padding: "9px 12px",
                background: "rgba(244,184,96,0.12)", color: "var(--lamp-soft)",
                border: "1px solid rgba(244,184,96,0.35)", borderRadius: 99,
                fontSize: 12, cursor: "pointer", fontWeight: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : playing ? (
                "■ Stop sample"
              ) : (
                "▸ Hear sample"
              )}
            </button>
            <button style={{
              padding: "9px 12px",
              background: "transparent", color: "var(--paper-dim)",
              border: "1px solid var(--ink-3)", borderRadius: 99,
              fontSize: 12, cursor: "pointer",
            }}>⋯</button>
          </div>
        </>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--lamp)", marginBottom: 8 }}>
            <span>● Training</span><span>Processing...</span>
          </div>
          <div style={{ height: 4, background: "var(--ink-1)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: "62%", height: "100%", background: "var(--lamp)" }} />
          </div>
        </div>
      )}
    </div>
  );
}
