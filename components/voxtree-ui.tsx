// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VoxMark, VoxWordmark, VoxMarkSpeaking } from './voxtree-logo';
import { TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakColor, TweakSlider, TweakToggle } from './tweaks-panel';

/* ---------- Sample data ---------- */

const STORIES = [
  { id: "1", title: "The Moon Who Forgot to Sleep",  series: "Goodnight Tales", ep: 4, mins: 8,  ages: "3–6", tone: "Gentle",    color: "#3B5176", art: "moon" },
  { id: "2", title: "Pip and the Paper Lantern",      series: "Goodnight Tales", ep: 5, mins: 6,  ages: "3–6", tone: "Cozy",      color: "#6B4A6E", art: "lantern" },
  { id: "3", title: "How the River Learned to Sing",  series: "Earth Songs",     ep: 1, mins: 11, ages: "5–8", tone: "Curious",   color: "#3F6E68", art: "river" },
  { id: "4", title: "The Bear Who Counted Stars",     series: "Goodnight Tales", ep: 6, mins: 9,  ages: "3–6", tone: "Soothing",  color: "#2F4978", art: "stars" },
  { id: "5", title: "Letters from a Long-ago Forest", series: "Earth Songs",     ep: 2, mins: 13, ages: "5–8", tone: "Curious",   color: "#4D6B3A", art: "forest" },
  { id: "6", title: "Tomi and the Wandering Cloud",   series: "Adventures",      ep: 1, mins: 10, ages: "4–7", tone: "Whimsical", color: "#7A5230", art: "cloud" },
  { id: "7", title: "What the Owl Said at Midnight",  series: "Goodnight Tales", ep: 7, mins: 7,  ages: "4–7", tone: "Soothing",  color: "#3A4A6A", art: "owl" },
  { id: "8", title: "The Quiet Color of Snow",        series: "Earth Songs",     ep: 3, mins: 9,  ages: "5–8", tone: "Gentle",    color: "#5B6F86", art: "snow" },
];

const CLONES = [
  { id: "v1", name: "Grandma Rose",     relation: "Grandmother", recorded: "Mar 12",  status: "ready",      lastUsed: "Tonight",      stories: 28, color: "#E8856C" },
  { id: "v2", name: "Papa Theo",        relation: "Grandfather", recorded: "Mar 14",  status: "ready",      lastUsed: "2 nights ago", stories: 14, color: "#F4B860" },
  { id: "v3", name: "Mom",              relation: "Mother",      recorded: "Feb 28",  status: "ready",      lastUsed: "Last week",    stories: 41, color: "#7FC4A4" },
  { id: "v4", name: "Auntie Lila",      relation: "Aunt",        recorded: "Mar 30",  status: "processing", lastUsed: "—",            stories: 0,  color: "#C58FB8" },
];

/* ---------- Visual primitives ---------- */

// Decorative story "art" — abstract twilight scenes, no AI-illustration slop.
function StoryArt({ kind, color, height = 180 }) {
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

  const scenes = {
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

// Animated soundwave bar group — synchronized to a "playing" boolean
function Waveform({ playing, count = 36, color = "var(--lamp)", height = 56 }) {
  // pseudo-random heights, fixed per index
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

/* ---------- Layout ---------- */

function Shell({ route, setRoute, t, children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar route={route} setRoute={setRoute} t={t} />
      <div style={{ flex: 1, position: "relative" }}>{children}</div>
      <Footer />
    </div>
  );
}

import Link from 'next/link';

function TopBar({ route, setRoute, t }) {
  const items = [
    { id: "home",    label: "Home" },
    { id: "library", label: "Library" },
    { id: "clones",  label: "Clones" },
    { id: "settings",label: "Family" },
  ];

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 40,
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      background: "linear-gradient(180deg, rgba(10,14,31,0.85), rgba(10,14,31,0.55))",
      borderBottom: "1px solid var(--ink-3)",
    }}>
      <div style={{
        maxWidth: 1280, margin: "0 auto",
        padding: "18px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
      }}>
        <button onClick={() => setRoute("home")} style={{
          background: "none", border: 0, padding: 0, cursor: "pointer", color: "inherit",
        }}>
          <VoxWordmark size={18} animate={false} />
        </button>

        <nav style={{ display: "flex", gap: 4 }}>
          {items.map(it => (
            <button key={it.id}
              onClick={() => setRoute(it.id)}
              style={{
                padding: "8px 16px",
                background: route === it.id ? "rgba(244,184,96,0.12)" : "transparent",
                color: route === it.id ? "var(--lamp-soft)" : "var(--paper-dim)",
                border: 0, borderRadius: 99,
                fontSize: 14, fontWeight: 500, cursor: "pointer",
                transition: "all .2s ease",
              }}>
              {it.label}
            </button>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px",
            background: "transparent",
            color: "var(--paper-dim)",
            border: "1px solid var(--ink-3)",
            borderRadius: 99, fontSize: 13, cursor: "pointer",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--moss)" }} />
            Family of 4
          </button>
          <Link href="/dashboard/settings" style={{
            width: 36, height: 36, borderRadius: 99,
            background: "linear-gradient(135deg, var(--rose), var(--lamp))",
            border: 0, color: "var(--ink-0)", fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center",
            textDecoration: "none", fontSize: 13,
          }}>
            JK
          </Link>
          <Link href="/dashboard/admin" style={{
            padding: "8px 14px",
            background: "transparent",
            color: "var(--paper-dim)",
            border: "1px solid var(--ink-3)",
            borderRadius: 99, fontSize: 13, textDecoration: "none",
          }}>
            Admin
          </Link>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid var(--ink-3)",
      padding: "32px 32px 48px",
      marginTop: 64,
      color: "var(--paper-mute)",
      fontSize: 12,
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <VoxMark size={22} color="var(--paper-mute)" />
          <span className="serif" style={{ fontSize: 18, color: "var(--paper-dim)" }}>
            Vox<span className="serif-italic">Tree</span>
          </span>
          <span style={{ marginLeft: 12 }}>Carrying clones through generations.</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <span>Privacy</span><span>Consent</span><span>Help</span><span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Views ---------- */

function HomeView({ setRoute, openPlayer, t }) {
  const [playingDemo, setPlayingDemo] = useState(true);
  const [cloneIdx, setCloneIdx] = useState(0);
  const recents = STORIES.slice(0, 3);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 24px" }}>
      {/* Hero */}
      <section style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 64, alignItems: "center", marginBottom: 96 }} className="fadeUp">
        <div>
          <div className="mono" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--lamp)", marginBottom: 32,
          }}>
            <span style={{ width: 18, height: 1, background: "var(--lamp)" }} />
            8:47 pm · Bedtime in 13 minutes
          </div>

          <h1 className="serif" style={{
            fontSize: "clamp(48px, 7vw, 92px)",
            lineHeight: 0.96, margin: 0,
            letterSpacing: "-0.025em",
          }}>
            The clones that<br />
            mean <span className="serif-italic" style={{ color: "var(--lamp)" }}>home</span>,
            <br/>read on cue.
          </h1>

          <p style={{
            marginTop: 28, maxWidth: 480,
            fontSize: 17, lineHeight: 1.55,
            color: "var(--paper-dim)",
          }}>
            Record a minute of Grandma. Then any bedtime story in our library
            is read in her clone — warm, unhurried, exactly hers. Tonight,
            and every night.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
            <button onClick={() => openPlayer(STORIES[0])} style={{
              padding: "16px 26px",
              background: "var(--lamp)",
              color: "var(--ink-0)",
              border: 0, borderRadius: 99,
              fontSize: 15, fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 0 0 1px rgba(244,184,96,0.4), 0 12px 40px -8px rgba(244,184,96,0.55)",
            }}>
              ▸ &nbsp;Start story
            </button>
            <button onClick={() => setRoute("clones")} style={{
              padding: "16px 26px",
              background: "transparent",
              color: "var(--paper)",
              border: "1px solid var(--ink-3)",
              borderRadius: 99,
              fontSize: 15, fontWeight: 500, cursor: "pointer",
            }}>
              Add a clone
            </button>
          </div>

          <div style={{ marginTop: 56, display: "flex", gap: 32, color: "var(--paper-mute)", fontSize: 12 }}>
            <Stat n="3" l="clones in your tree" />
            <Stat n="83" l="stories read" />
            <Stat n="41" l="hours of bedtime" />
          </div>
        </div>

        {/* Right: live tree / lamp visual */}
        <HeroLamp playing={playingDemo} onToggle={() => setPlayingDemo(p => !p)} cloneIdx={cloneIdx} setCloneIdx={setCloneIdx} />
      </section>

      {/* Continue */}
      <Section
        eyebrow="Pick up where you stopped"
        title={<>Tonight, on the <span className="serif-italic">moon-side</span>.</>}
        action={<TextLink onClick={() => setRoute("library")}>Browse the library →</TextLink>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {recents.map(s => (
            <StoryCard key={s.id} story={s} onClick={() => openPlayer(s)} />
          ))}
        </div>
      </Section>

      {/* The Family Tree strip */}
      <Section
        eyebrow="Your clone tree"
        title={<>Four <span className="serif-italic">familiar</span> clones, ready.</>}
        action={<TextLink onClick={() => setRoute("clones")}>Manage clones →</TextLink>}
      >
        <FamilyTreeStrip />
      </Section>
    </div>
  );
}

function Stat({ n, l }) {
  return (
    <div>
      <div className="serif" style={{ fontSize: 32, lineHeight: 1, color: "var(--paper)" }}>{n}</div>
      <div style={{ fontSize: 11, marginTop: 4, letterSpacing: "0.05em" }}>{l}</div>
    </div>
  );
}

function TextLink({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: 0, padding: 0, cursor: "pointer",
      color: "var(--lamp-soft)", fontSize: 13,
    }}>{children}</button>
  );
}

function Section({ eyebrow, title, action, children }) {
  return (
    <section style={{ marginBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, gap: 16 }}>
        <div>
          <div className="mono" style={{
            fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--paper-mute)", marginBottom: 8,
          }}>{eyebrow}</div>
          <h2 className="serif" style={{ fontSize: 36, margin: 0, letterSpacing: "-0.02em" }}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function HeroLamp({ playing, onToggle, cloneIdx, setCloneIdx }) {
  const clone = CLONES[cloneIdx % CLONES.length];
  return (
    <div style={{ position: "relative", aspectRatio: "1/1.05" }}>
      {/* lamp glow */}
      <div style={{
        position: "absolute", inset: -40,
        background: "radial-gradient(circle at 50% 35%, rgba(244,184,96,0.32), transparent 55%)",
        animation: playing ? "lampPulse 4s ease-in-out infinite" : "none",
        pointerEvents: "none",
      }} />

      {/* Big tree mark, animated */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg viewBox="0 0 320 320" width="100%" height="100%">
          <defs>
            <radialGradient id="lampG" cx="50%" cy="38%" r="60%">
              <stop offset="0" stopColor="#F4B860" stopOpacity="0.45" />
              <stop offset="1" stopColor="#F4B860" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="160" cy="120" r="120" fill="url(#lampG)" />

          {/* concentric ripples — larger version */}
          {[110, 88, 66, 44, 22].map((r, i) => (
            <path key={i}
              d={`M${160 - r} 220 A${r} ${r} 0 0 1 ${160 + r} 220`}
              stroke="#F4ECDB"
              strokeWidth={2 + i * 0.3}
              opacity={playing ? 0.2 + i * 0.18 : 0.12 + i * 0.1}
              fill="none"
              strokeLinecap="round"
              style={{
                transformOrigin: "160px 220px",
                animation: playing ? `ripple-${i} ${3.2 + i * 0.4}s ease-in-out infinite` : "none",
              }}
            />
          ))}

          {/* top sprout */}
          <circle cx="160" cy="60" r="6" fill="#F4ECDB" />

          {/* trunk */}
          <path d="M154 220 Q156 250 158 285 L162 285 Q164 250 166 220 Z" fill="#F4ECDB" />
          <path d="M120 285 L200 285" stroke="#F4ECDB" strokeWidth="3" strokeLinecap="round" opacity="0.4" />

          <style>{`
            @keyframes ripple-0 { 50%{ opacity: 0.6; } }
            @keyframes ripple-1 { 50%{ opacity: 0.7; } }
            @keyframes ripple-2 { 50%{ opacity: 0.85; } }
            @keyframes ripple-3 { 50%{ opacity: 1; } }
            @keyframes ripple-4 { 50%{ opacity: 1; } }
          `}</style>
        </svg>
      </div>

      {/* clone chip floating bottom */}
      <div style={{
        position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)",
        width: "min(380px, 90%)",
        background: "var(--ink-2)",
        border: "1px solid var(--ink-3)",
        borderRadius: 22,
        padding: 18,
        boxShadow: "0 24px 60px -16px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Avatar clone={clone} size={44} ring />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--paper-mute)", textTransform: "uppercase" }}>
              Now reading
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--paper)" }}>
              {clone.name} <span style={{ color: "var(--paper-mute)", fontWeight: 400 }}>· The Moon Who Forgot to Sleep</span>
            </div>
          </div>
          <button onClick={onToggle} style={{
            width: 36, height: 36, borderRadius: 99,
            background: "var(--lamp)", color: "var(--ink-0)",
            border: 0, cursor: "pointer", fontSize: 12, fontWeight: 700,
          }}>
            {playing ? "❚❚" : "▸"}
          </button>
        </div>
        <Waveform playing={playing} count={42} height={28} />
        {/* clone tabs */}
        <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
          {CLONES.slice(0, 4).map((v, i) => (
            <button key={v.id} onClick={() => setCloneIdx(i)}
              style={{
                flex: 1, padding: "6px 8px",
                background: i === cloneIdx ? "rgba(244,184,96,0.14)" : "transparent",
                border: `1px solid ${i === cloneIdx ? "rgba(244,184,96,0.35)" : "var(--ink-3)"}`,
                borderRadius: 8,
                fontSize: 11, color: i === cloneIdx ? "var(--lamp-soft)" : "var(--paper-mute)",
                cursor: "pointer", textAlign: "center",
              }}>
              {v.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Avatar({ clone, size = 40, ring }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 99,
      background: `linear-gradient(135deg, ${clone.color}, ${clone.color}99)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--ink-0)", fontWeight: 600, fontSize: size * 0.36,
      boxShadow: ring ? `0 0 0 3px var(--ink-2), 0 0 0 4px ${clone.color}55` : "none",
      flexShrink: 0,
    }}>
      {clone.name.split(" ").map(s => s[0]).slice(0,2).join("")}
    </div>
  );
}

function StoryCard({ story, onClick }) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", display: "block", width: "100%",
      background: "var(--ink-2)", border: "1px solid var(--ink-3)",
      borderRadius: 20, overflow: "hidden",
      padding: 0, cursor: "pointer",
      transition: "transform .25s ease, border-color .2s",
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(244,184,96,0.35)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "var(--ink-3)"; }}
    >
      <StoryArt kind={story.art} color={story.color} height={170} />
      <div style={{ padding: 18 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", marginBottom: 8 }}>
          {story.series} · Ep {story.ep}
        </div>
        <h3 className="serif" style={{ fontSize: 22, margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
          {story.title}
        </h3>
        <div style={{ display: "flex", gap: 10, marginTop: 14, fontSize: 12, color: "var(--paper-dim)" }}>
          <Pill>{story.mins} min</Pill>
          <Pill>Ages {story.ages}</Pill>
          <Pill subtle>{story.tone}</Pill>
        </div>
      </div>
    </button>
  );
}

function Pill({ children, subtle }) {
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

function FamilyTreeStrip() {
  return (
    <div style={{
      position: "relative",
      background: "var(--ink-1)",
      border: "1px solid var(--ink-3)",
      borderRadius: 24,
      padding: "40px 36px 36px",
      overflow: "hidden",
    }}>
      {/* faint connecting tree lines */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <path d="M50% 30 L50% 70 L20% 70 L20% 130 M50% 70 L40% 70 L40% 130 M50% 70 L60% 70 L60% 130 M50% 70 L80% 70 L80% 130"
              stroke="var(--ink-3)" strokeWidth="1" fill="none" />
      </svg>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
        <div className="mono" style={{
          padding: "6px 14px",
          background: "var(--ink-2)",
          border: "1px solid var(--ink-3)",
          borderRadius: 99,
          fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
          color: "var(--paper-dim)",
        }}>
          The Khan Family · Est. 2017
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${CLONES.length}, 1fr)`, gap: 20 }}>
        {CLONES.map(v => <CloneTreeNode key={v.id} clone={v} />)}
      </div>
    </div>
  );
}

function CloneTreeNode({ clone }) {
  const ready = clone.status === "ready";
  return (
    <div style={{
      background: "var(--ink-2)",
      border: `1px solid ${ready ? "var(--ink-3)" : "rgba(244,184,96,0.3)"}`,
      borderRadius: 18,
      padding: 18,
      position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <Avatar clone={clone} size={42} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--paper)" }}>{clone.name}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>
            {clone.relation}
          </div>
        </div>
      </div>
      <Waveform playing={false} count={20} height={20} color={clone.color} />
      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--paper-mute)" }}>
        {ready ? <span>{clone.stories} reads</span> : <span style={{ color: "var(--lamp)" }}>● Training…</span>}
        <span>{clone.lastUsed}</span>
      </div>
    </div>
  );
}

/* ---------- Library view ---------- */

function LibraryView({ openPlayer }) {
  const [filter, setFilter] = useState("all");
  const filters = [
    { id: "all",  label: "All stories" },
    { id: "goodnight", label: "Goodnight Tales" },
    { id: "earth", label: "Earth Songs" },
    { id: "adv", label: "Adventures" },
    { id: "short", label: "Under 10 min" },
  ];
  const filtered = STORIES.filter(s => {
    if (filter === "all") return true;
    if (filter === "goodnight") return s.series === "Goodnight Tales";
    if (filter === "earth") return s.series === "Earth Songs";
    if (filter === "adv") return s.series === "Adventures";
    if (filter === "short") return s.mins < 10;
    return true;
  });

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 24px" }}>
      <div className="fadeUp" style={{ marginBottom: 40 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
          The Library
        </div>
        <h1 className="serif" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0, letterSpacing: "-0.02em", maxWidth: 900 }}>
          Eighty-three stories,<br/>
          <span className="serif-italic" style={{ color: "var(--lamp)" }}>narrated by the people who love them most.</span>
        </h1>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32, alignItems: "center" }}>
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: "9px 16px",
            background: filter === f.id ? "var(--paper)" : "transparent",
            color: filter === f.id ? "var(--ink-0)" : "var(--paper-dim)",
            border: `1px solid ${filter === f.id ? "var(--paper)" : "var(--ink-3)"}`,
            borderRadius: 99, fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}>{f.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {filtered.length} stories · narrator: Grandma Rose
        </div>
      </div>

      {/* Editorial featured row */}
      <FeaturedRow story={filtered[0]} openPlayer={openPlayer} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20, marginTop: 40 }}>
        {filtered.slice(1).map(s => (
          <StoryCard key={s.id} story={s} onClick={() => openPlayer(s)} />
        ))}
      </div>
    </div>
  );
}

function FeaturedRow({ story, openPlayer }) {
  if (!story) return null;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1.1fr 1fr",
      background: "var(--ink-1)", border: "1px solid var(--ink-3)",
      borderRadius: 28, overflow: "hidden",
      minHeight: 360,
    }}>
      <div style={{ position: "relative" }}>
        <StoryArt kind={story.art} color={story.color} height="100%" />
      </div>
      <div style={{ padding: "44px 44px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 14 }}>
          Featured
        </div>
        <h2 className="serif" style={{ fontSize: 44, lineHeight: 1.05, margin: 0, letterSpacing: "-0.02em" }}>
          {story.title}
        </h2>
        <p style={{ marginTop: 16, color: "var(--paper-dim)", lineHeight: 1.6, maxWidth: 460, fontSize: 15 }}>
          A drowsy moon refuses to set, and the children of the village must coax it gently back to sleep with old lullabies — the kind only grandmothers remember.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 28, alignItems: "center" }}>
          <button onClick={() => openPlayer(story)} style={{
            padding: "14px 22px",
            background: "var(--lamp)", color: "var(--ink-0)",
            border: 0, borderRadius: 99,
            fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>▸ &nbsp; Read now</button>
          <button style={{
            padding: "14px 22px",
            background: "transparent", color: "var(--paper)",
            border: "1px solid var(--ink-3)", borderRadius: 99,
            fontSize: 14, cursor: "pointer",
          }}>Save for later</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Player view ---------- */

function PlayerView({ story, setRoute }) {
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(38);
  const [cloneIdx, setCloneIdx] = useState(0);
  const clone = CLONES[cloneIdx];

  // simulated progress
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setProgress(p => (p >= 100 ? 0 : p + 0.18)), 250);
    return () => clearInterval(t);
  }, [playing]);

  if (!story) {
    return <div style={{ padding: 96, textAlign: "center" }}>No story selected. <button onClick={() => setRoute("library")} style={{ color: "var(--lamp)", background: "none", border: 0, cursor: "pointer" }}>Pick one →</button></div>;
  }

  const elapsed = Math.floor(story.mins * 60 * (progress / 100));
  const total = story.mins * 60;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 24px" }}>
      <button onClick={() => setRoute("library")} style={{
        background: "none", border: 0, color: "var(--paper-mute)",
        cursor: "pointer", marginBottom: 24, fontSize: 13,
      }}>← Back to library</button>

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
          <StoryArt kind={story.art} color={story.color} height="100%" />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, transparent 40%, rgba(10,14,31,0.85) 100%)",
          }} />
          <div style={{ position: "absolute", left: 32, right: 32, bottom: 32 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp-soft)", marginBottom: 12 }}>
              {story.series} · Episode {story.ep}
            </div>
            <h1 className="serif" style={{ fontSize: 48, lineHeight: 1.02, margin: 0, letterSpacing: "-0.02em" }}>
              {story.title}
            </h1>
          </div>
        </div>

        {/* Player panel */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ position: "relative" }}>
              <Avatar clone={clone} size={64} ring />
              {playing && (
                <div style={{
                  position: "absolute", inset: -6, borderRadius: 99,
                  border: `2px solid ${clone.color}`,
                  animation: "lampPulse 1.6s ease-in-out infinite",
                  pointerEvents: "none",
                }} />
              )}
            </div>
            <div>
              <div className="mono" style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--paper-mute)", textTransform: "uppercase" }}>
                Narrated by
              </div>
              <div className="serif" style={{ fontSize: 28, lineHeight: 1.1, marginTop: 4 }}>
                {clone.name}
              </div>
            </div>
          </div>

          {/* Big waveform */}
          <div style={{
            background: "var(--ink-2)", border: "1px solid var(--ink-3)",
            borderRadius: 22, padding: 24,
          }}>
            <div style={{ position: "relative" }}>
              <Waveform playing={playing} count={64} height={72} color={clone.color} />
              {/* playhead */}
              <div style={{
                position: "absolute", top: 0, bottom: 0,
                left: `${progress}%`,
                width: 2, background: "var(--lamp)",
                boxShadow: "0 0 12px var(--lamp)",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 12, color: "var(--paper-mute)" }} className="mono">
              <span>{fmt(elapsed)}</span>
              <span>−{fmt(total - elapsed)}</span>
            </div>
          </div>

          {/* Transport */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, marginTop: 32 }}>
            <IconBtn label="−15">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5V2L7 6l5 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /><text x="12" y="16" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none">15</text></svg>
            </IconBtn>
            <button onClick={() => setPlaying(p => !p)} style={{
              width: 72, height: 72, borderRadius: 99,
              background: "var(--lamp)", color: "var(--ink-0)",
              border: 0, cursor: "pointer", fontSize: 22, fontWeight: 700,
              boxShadow: "0 0 0 6px rgba(244,184,96,0.18), 0 20px 50px -10px rgba(244,184,96,0.5)",
            }}>{playing ? "❚❚" : "▸"}</button>
            <IconBtn label="+15">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" transform="scale(-1,1) translate(-24,0)"><path d="M12 5V2L7 6l5 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
            </IconBtn>
          </div>

          {/* Clone switcher */}
          <div style={{ marginTop: 36 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--paper-mute)", marginBottom: 12 }}>
              Switch the narrator
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {CLONES.map((v, i) => (
                <button key={v.id}
                  disabled={v.status !== "ready"}
                  onClick={() => setCloneIdx(i)}
                  style={{
                    background: i === cloneIdx ? "rgba(244,184,96,0.1)" : "var(--ink-2)",
                    border: `1px solid ${i === cloneIdx ? "rgba(244,184,96,0.45)" : "var(--ink-3)"}`,
                    borderRadius: 16, padding: 14,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                    cursor: v.status === "ready" ? "pointer" : "not-allowed",
                    color: "var(--paper)",
                    opacity: v.status === "ready" ? 1 : 0.5,
                  }}>
                  <Avatar clone={v} size={38} />
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{v.name.split(" ")[0]}</div>
                  <div className="mono" style={{ fontSize: 9, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {v.status === "ready" ? v.relation : "Training"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Bedtime extras */}
          <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Extra icon="🌙" label="Sleep timer" value="Off" />
            <Extra icon="✨" label="Background" value="Soft rain" />
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  return `${m}:${sec}`;
}

function IconBtn({ children, label }) {
  return (
    <button style={{
      width: 52, height: 52, borderRadius: 99,
      background: "var(--ink-2)", border: "1px solid var(--ink-3)",
      color: "var(--paper-dim)", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
    }}>
      {children}
      <span className="mono" style={{ position: "absolute", bottom: -18, fontSize: 9, color: "var(--paper-mute)", letterSpacing: "0.08em" }}>{label}</span>
    </button>
  );
}

function Extra({ icon, label, value }) {
  return (
    <button style={{
      padding: 16, textAlign: "left",
      background: "var(--ink-2)", border: "1px solid var(--ink-3)",
      borderRadius: 16, cursor: "pointer", color: "var(--paper)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18 }}>{icon}</div>
      <div className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", marginTop: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 14, marginTop: 4 }}>{value}</div>
    </button>
  );
}

/* ---------- Clones view ---------- */

function ClonesView({ openAddClone }) {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 24px" }}>
      <div className="fadeUp" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, gap: 24 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
            Your clone tree
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0, letterSpacing: "-0.02em" }}>
            The Khan family,<br/><span className="serif-italic" style={{ color: "var(--lamp)" }}>read aloud.</span>
          </h1>
        </div>
        <button onClick={openAddClone} style={{
          padding: "14px 22px",
          background: "var(--lamp)", color: "var(--ink-0)",
          border: 0, borderRadius: 99,
          fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>＋ &nbsp;Add a clone</button>
      </div>

      {/* Family-tree diagram */}
      <div style={{
        position: "relative",
        background: "var(--ink-1)", border: "1px solid var(--ink-3)",
        borderRadius: 28, padding: "48px 48px 56px",
        overflow: "hidden",
        marginBottom: 40,
      }}>
        {/* connecting lines svg */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} preserveAspectRatio="none" viewBox="0 0 100 100">
          <path d="M50 22 L50 50 L15 50 L15 75 M50 50 L38 50 L38 75 M50 50 L62 50 L62 75 M50 50 L85 50 L85 75"
                stroke="rgba(244,236,219,0.12)" strokeWidth="0.2" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* root */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 64 }}>
          <div style={{
            padding: "14px 24px",
            background: "var(--ink-2)",
            border: "1px solid rgba(244,184,96,0.35)",
            borderRadius: 99,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <VoxMark size={28} color="var(--lamp)" />
            <div>
              <div className="serif" style={{ fontSize: 22, lineHeight: 1 }}>The Khan family</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>
                4 clones · 83 reads
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {CLONES.map(v => <CloneFullCard key={v.id} clone={v} />)}
        </div>
      </div>

      {/* Audit log */}
      <Section eyebrow="Recent clone activity" title={<>A <span className="serif-italic">small book</span> of every read.</>}>
        <div style={{
          background: "var(--ink-1)", border: "1px solid var(--ink-3)",
          borderRadius: 20, overflow: "hidden",
        }}>
          {[
            { who: "Grandma Rose", what: "The Moon Who Forgot to Sleep", when: "Tonight · 8:14 pm",   by: "Yusuf" },
            { who: "Mom",          what: "Pip and the Paper Lantern",     when: "Last night · 7:42 pm", by: "Aisha" },
            { who: "Papa Theo",    what: "What the Owl Said at Midnight", when: "Tue · 8:01 pm",        by: "Yusuf" },
            { who: "Grandma Rose", what: "The Quiet Color of Snow",       when: "Mon · 7:55 pm",        by: "Aisha" },
          ].map((row, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "180px 1fr 180px 80px",
              padding: "18px 24px", gap: 16,
              borderTop: i === 0 ? 0 : "1px solid var(--ink-3)",
              alignItems: "center", fontSize: 14,
            }}>
              <div style={{ color: "var(--paper)", fontWeight: 500 }}>{row.who}</div>
              <div className="serif" style={{ fontSize: 17, color: "var(--paper)" }}>“{row.what}”</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", letterSpacing: "0.05em" }}>{row.when}</div>
              <div style={{ fontSize: 12, color: "var(--paper-dim)", textAlign: "right" }}>for {row.by}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function CloneFullCard({ clone }) {
  const ready = clone.status === "ready";
  return (
    <div style={{
      background: "var(--ink-2)",
      border: `1px solid ${ready ? "var(--ink-3)" : "rgba(244,184,96,0.35)"}`,
      borderRadius: 20, padding: 22,
      position: "relative",
    }}>
      <Avatar clone={clone} size={56} ring />
      <div style={{ marginTop: 16 }}>
        <div className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>{clone.name}</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 6 }}>
          {clone.relation} · added {clone.recorded}
        </div>
      </div>
      <div style={{ margin: "18px 0" }}>
        <Waveform playing={false} count={28} height={28} color={clone.color} />
      </div>
      {ready ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--paper-dim)" }}>
            <span>{clone.stories} reads</span>
            <span>{clone.lastUsed}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button style={{
              flex: 1, padding: "9px 12px",
              background: "rgba(244,184,96,0.12)", color: "var(--lamp-soft)",
              border: "1px solid rgba(244,184,96,0.35)", borderRadius: 99,
              fontSize: 12, cursor: "pointer", fontWeight: 500,
            }}>▸ Hear sample</button>
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
            <span>● Training</span><span>~2 min left</span>
          </div>
          <div style={{ height: 4, background: "var(--ink-1)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: "62%", height: "100%", background: "var(--lamp)" }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Add Clone modal view ---------- */

function AddCloneView({ close }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("Grandmother");
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);

  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [processingStatus, setProcessingStatus] = useState("idle");

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setRecorded(true);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
      setRecorded(false);
      setError(null);
    } catch (err) {
      setError("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setRecording(false);
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  };

  const submitClone = async () => {
    if (!audioBlob || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const createRes = await fetch("/api/voices/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contentType: audioBlob.type || "audio/webm" })
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        if (createData.upgradeRequired) throw new Error("Clone profile limit reached. " + createData.upgradePrompt);
        throw new Error(createData.error || "Failed to create clone record.");
      }

      const uploadRes = await fetch(createData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": audioBlob.type || "audio/webm" },
        body: audioBlob
      });
      if (!uploadRes.ok) throw new Error("Failed to upload audio sample.");

      setStep(3);
      setProcessingStatus("processing");
      const processRes = await fetch("/api/voices/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: createData.voiceId })
      });
      const processData = await processRes.json();
      if (!processRes.ok) throw new Error(processData.error || "Failed to process clone.");
      
      setProcessingStatus("ready");
    } catch (err) {
      setError(err.message);
      if (step === 3) setProcessingStatus("failed");
    } finally {
      setBusy(false);
    }
  };

  // Ensure tracks are stopped on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorder) {
        mediaRecorder.stream?.getTracks().forEach(track => track.stop());
      }
    };
  }, [mediaRecorder]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 80,
      background: "rgba(10,14,31,0.85)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "min(680px, 100%)",
        background: "var(--ink-1)", border: "1px solid var(--ink-3)",
        borderRadius: 28, padding: 40,
        position: "relative",
        maxHeight: "90vh", overflow: "auto",
      }}>
        <button onClick={close} style={{
          position: "absolute", top: 20, right: 20,
          width: 36, height: 36, borderRadius: 99,
          background: "var(--ink-2)", border: "1px solid var(--ink-3)",
          color: "var(--paper-dim)", cursor: "pointer", fontSize: 16,
        }}>×</button>

        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 8 }}>
          Step {step} of 3
        </div>
        <h2 className="serif" style={{ fontSize: 36, margin: 0, lineHeight: 1.05 }}>
          {step === 1 && <>Who would you like <span className="serif-italic">to record</span>?</>}
          {step === 2 && <>Read this <span className="serif-italic">aloud</span>, gently.</>}
          {step === 3 && <>It's <span className="serif-italic" style={{ color: "var(--lamp)" }}>their clone</span>, now.</>}
        </h2>

        {step === 1 && (
          <div style={{ marginTop: 32 }}>
            <Field label="Their name">
              <input placeholder="e.g. Grandma Rose"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%", background: "var(--ink-2)",
                  border: "1px solid var(--ink-3)", borderRadius: 12,
                  padding: "14px 16px", color: "var(--paper)",
                  fontSize: 16, fontFamily: "inherit",
                  outline: "none",
                }} />
            </Field>
            <Field label="Their relation to the child">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["Grandmother","Grandfather","Mother","Father","Aunt","Uncle","Sibling","Other"].map(r => (
                  <button key={r} onClick={() => setRelation(r)} style={{
                    padding: "8px 14px",
                    background: r === relation ? "rgba(244,184,96,0.12)" : "var(--ink-2)",
                    color: r === relation ? "var(--lamp-soft)" : "var(--paper-dim)",
                    border: `1px solid ${r === relation ? "rgba(244,184,96,0.35)" : "var(--ink-3)"}`,
                    borderRadius: 99, fontSize: 13, cursor: "pointer",
                  }}>{r}</button>
                ))}
              </div>
            </Field>
            <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => { if (name.trim()) setStep(2); }} style={{
                padding: "12px 22px",
                background: name.trim() ? "var(--lamp)" : "var(--ink-2)",
                color: name.trim() ? "var(--ink-0)" : "var(--paper-mute)",
                border: 0, borderRadius: 99, fontWeight: 600, fontSize: 14, 
                cursor: name.trim() ? "pointer" : "not-allowed",
              }}>Continue →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ marginTop: 28 }}>
            <p className="serif" style={{
              fontSize: 22, lineHeight: 1.5, color: "var(--paper)",
              background: "var(--ink-2)", border: "1px solid var(--ink-3)",
              padding: 24, borderRadius: 18,
              maxWidth: "100%",
            }}>
              “There was once a small house, at the edge of a quieter wood, where the lamps stayed lit for whoever might be walking home in the dark. The wind would sometimes pause at the window, just long enough to listen.”
            </p>
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <button
                onClick={recording ? stopRecording : startRecording}
                style={{
                  width: 120, height: 120, borderRadius: 99,
                  background: recording ? "var(--rose)" : "var(--lamp)",
                  color: "var(--ink-0)", border: 0, cursor: "pointer",
                  fontSize: 14, fontWeight: 600,
                  boxShadow: `0 0 0 ${recording ? 14 : 8}px ${recording ? "rgba(232,133,108,0.18)" : "rgba(244,184,96,0.18)"}`,
                  transition: "box-shadow .3s",
                }}>
                {recording ? "Stop" : recorded ? "Re-record" : "● Record"}
              </button>
              <div style={{ width: "100%", maxWidth: 400 }}>
                <Waveform playing={recording} count={48} height={40} color={recording ? "var(--rose)" : "var(--paper-mute)"} />
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", letterSpacing: "0.08em", textAlign: "center" }}>
                {recording ? "Listening… speak naturally" : recorded ? "Audio captured · clear & well-spaced" : "About 60 seconds is plenty"}
              </div>
              {error && <div style={{ color: "var(--rose)", fontSize: 13, marginTop: 8 }}>{error}</div>}
            </div>
            <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setStep(1)} disabled={busy} style={{
                background: "none", border: 0, color: "var(--paper-dim)", cursor: busy ? "not-allowed" : "pointer", fontSize: 14,
              }}>← Back</button>
              <button onClick={submitClone}
                disabled={!recorded || busy}
                style={{
                  padding: "12px 22px",
                  background: recorded && !busy ? "var(--lamp)" : "var(--ink-2)",
                  color: recorded && !busy ? "var(--ink-0)" : "var(--paper-mute)",
                  border: recorded && !busy ? 0 : "1px solid var(--ink-3)",
                  borderRadius: 99, fontWeight: 600, fontSize: 14,
                  cursor: recorded && !busy ? "pointer" : "not-allowed",
                }}>{busy ? "Processing..." : "Continue →"}</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ marginTop: 28, textAlign: "center" }}>
            <div style={{ margin: "20px auto" }}>
              {processingStatus === "failed" ? (
                 <div style={{ color: "var(--rose)", fontSize: 48, fontWeight: 'bold' }}>X</div>
              ) : (
                 <VoxMarkSpeaking size={120} color={processingStatus === "ready" ? "var(--lamp)" : "var(--paper-mute)"} />
              )}
            </div>
            <p style={{ color: "var(--paper-dim)", maxWidth: 440, margin: "0 auto", lineHeight: 1.6 }}>
              {processingStatus === "processing" || processingStatus === "uploading" ? (
                `We're cloning ${name || 'your'}'s voice. This usually takes 1-2 minutes.`
              ) : processingStatus === "failed" ? (
                error || "Voice cloning failed. Please try again."
              ) : (
                `We've planted ${name || 'their clone'} in your tree. Stories are ready to be narrated.`
              )}
            </p>
            <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 12 }}>
              {processingStatus === "failed" ? (
                <button onClick={() => setStep(2)} style={{
                  padding: "14px 24px",
                  background: "var(--ink-2)", color: "var(--paper)",
                  border: "1px solid var(--ink-3)", borderRadius: 99, fontWeight: 600, fontSize: 14, cursor: "pointer",
                }}>Try again</button>
              ) : (
                <button onClick={close} disabled={processingStatus !== "ready"} style={{
                  padding: "14px 24px",
                  background: processingStatus === "ready" ? "var(--lamp)" : "var(--ink-2)", 
                  color: processingStatus === "ready" ? "var(--ink-0)" : "var(--paper-mute)",
                  border: 0, borderRadius: 99, fontWeight: 600, fontSize: 14, cursor: processingStatus === "ready" ? "pointer" : "not-allowed",
                }}>Take me home</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 20 }}>
      <div className="mono" style={{
        fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
        color: "var(--paper-mute)", marginBottom: 10,
      }}>{label}</div>
      {children}
    </label>
  );
}

/* ---------- Settings stub ---------- */

function SettingsView() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px" }}>
      <h1 className="serif" style={{ fontSize: 56, margin: 0, letterSpacing: "-0.02em" }}>
        Family <span className="serif-italic" style={{ color: "var(--lamp)" }}>settings</span>
      </h1>
      <p style={{ color: "var(--paper-dim)", marginTop: 12, fontSize: 16 }}>
        Children, consent, and the small things that make bedtime quieter.
      </p>

      <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[
          { e: "Children",     t: "2 little readers",   d: "Yusuf (5) · Aisha (7)" },
          { e: "Consent",      t: "All clones verified", d: "Re-confirmed Mar 30" },
          { e: "Plan",         t: "Family · $19.99/mo",  d: "Renews May 24, 2026" },
          { e: "Bedtime",      t: "9:00 pm weekdays",    d: "Auto-dim app at 9:30" },
          { e: "Background",   t: "Soft rain by default", d: "Per story override" },
          { e: "Privacy",      t: "Clones stay yours",   d: "Never used to train models" },
        ].map((row, i) => (
          <div key={i} style={{
            background: "var(--ink-2)", border: "1px solid var(--ink-3)",
            borderRadius: 18, padding: 22,
          }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {row.e}
            </div>
            <div className="serif" style={{ fontSize: 22, marginTop: 8, lineHeight: 1.15 }}>{row.t}</div>
            <div style={{ fontSize: 13, color: "var(--paper-dim)", marginTop: 6 }}>{row.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- App root ---------- */

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "amber",
  "density": "comfortable",
  "starfield": true,
  "showWordmark": true
}/*EDITMODE-END*/;

export function VoxTreeUI() {
  const [route, setRoute] = useState("home");
  const [story, setStory] = useState(null);
  const [showAddClone, setShowAddClone] = useState(false);
  const [t, setTweak] = useTweaks(DEFAULTS);

  // Apply accent tweak by mutating CSS variable
  useEffect(() => {
    const map = {
      amber:  { lamp: "#F4B860", soft: "#FFD79A" },
      rose:   { lamp: "#E8856C", soft: "#F4B0A0" },
      moss:   { lamp: "#7FC4A4", soft: "#A8D5BA" },
      plum:   { lamp: "#C58FB8", soft: "#E0B4D6" },
    };
    const c = map[t.accent] || map.amber;
    document.documentElement.style.setProperty("--lamp", c.lamp);
    document.documentElement.style.setProperty("--lamp-soft", c.soft);
  }, [t.accent]);

  useEffect(() => {
    document.body.dataset.starfield = t.starfield ? "on" : "off";
  }, [t.starfield]);

  const openPlayer = (s) => { setStory(s); setRoute("player"); };

  return (
    <>
      <Shell route={route} setRoute={setRoute} t={t}>
        {route === "home"     && <HomeView    setRoute={setRoute} openPlayer={openPlayer} t={t} />}
        {route === "library"  && <LibraryView openPlayer={openPlayer} />}
        {route === "player"   && <PlayerView  story={story} setRoute={setRoute} />}
        {route === "clones"   && <ClonesView  openAddClone={() => setShowAddClone(true)} />}
        {route === "settings" && <SettingsView />}
      </Shell>

      {showAddClone && <AddCloneView close={() => setShowAddClone(false)} />}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Accent color">
          <TweakRadio label="Lamp" value={t.accent}
            onChange={(v) => setTweak("accent", v)}
            options={[
              { value: "amber", label: "Amber" },
              { value: "rose",  label: "Rose"  },
              { value: "moss",  label: "Moss"  },
              { value: "plum",  label: "Plum"  },
            ]} />
        </TweakSection>
        <TweakSection label="Atmosphere">
          <TweakToggle label="Starfield" value={t.starfield}
            onChange={(v) => setTweak("starfield", v)} />
        </TweakSection>
        <TweakSection label="Jump to view">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[
              ["home", "Home"], ["library", "Library"],
              ["clones", "Clones"], ["settings", "Settings"],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setRoute(id)}
                style={{
                  padding: "8px 12px",
                  background: route === id ? "rgba(244,184,96,0.15)" : "rgba(255,255,255,0.04)",
                  color: route === id ? "#F4B860" : "inherit",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                }}>{label}</button>
            ))}
            <button onClick={() => openPlayer(STORIES[0])}
              style={{
                gridColumn: "1 / -1",
                padding: "8px 12px",
                background: route === "player" ? "rgba(244,184,96,0.15)" : "rgba(255,255,255,0.04)",
                color: route === "player" ? "#F4B860" : "inherit",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}>Open the Player</button>
            <button onClick={() => setShowAddClone(true)}
              style={{
                gridColumn: "1 / -1",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.04)",
                color: "inherit",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}>Add-clone flow</button>
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

/* eslint-disable */
