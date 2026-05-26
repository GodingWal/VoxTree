"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TwilightShell } from "@/components/twilight-layout";
import { Avatar, Waveform, StoryArt, Section, TextLink, CloneFullCard } from "@/components/twilight-ui";

// Mock Data
const CLONES = [
  { id: "c1", name: "Grandma Rose", relation: "Grandmother", color: "#E8856C", status: "ready", stories: 83, lastUsed: "Tonight", recorded: "Sep 2017", avatar_url: "/mock_pixar_character.png" },
  { id: "c2", name: "Papa Theo", relation: "Grandfather", color: "#F4B860", status: "ready", stories: 41, lastUsed: "Tue", recorded: "Dec 2019", avatar_url: "/mock_pixar_character.png" },
  { id: "c3", name: "Mom", relation: "Mother", color: "#7FC4A4", status: "ready", stories: 12, lastUsed: "Last night", recorded: "Jan 2024", avatar_url: "/mock_pixar_character.png" },
  { id: "c4", name: "Aunt Sarah", relation: "Aunt", color: "#C58FB8", status: "processing", stories: 0, lastUsed: "—", recorded: "Just now", avatar_url: "/mock_pixar_character.png" },
];

const STORIES = [
  { id: "s1", series: "Goodnight Tales", ep: 14, title: "The Moon Who Forgot to Sleep", mins: 12, ages: "3-6", tone: "Calming", color: "#E8856C", art: "moon" },
  { id: "s2", series: "Earth Songs", ep: 3, title: "What the Owl Said at Midnight", mins: 8, ages: "4-7", tone: "Curious", color: "#F4B860", art: "owl" },
  { id: "s3", series: "Goodnight Tales", ep: 15, title: "The Quiet Color of Snow", mins: 15, ages: "3-6", tone: "Soothing", color: "#7FC4A4", art: "snow" },
];

export default function Home() {
  const [playingDemo, setPlayingDemo] = useState(true);
  const [cloneIdx, setCloneIdx] = useState(0);

  return (
    <TwilightShell>
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
              <Link href="/browse" style={{
                padding: "16px 26px",
                background: "var(--lamp)", color: "var(--ink-0)", textDecoration: "none",
                border: 0, borderRadius: 99,
                fontSize: 15, fontWeight: 600, display: "inline-block",
                boxShadow: "0 0 0 1px rgba(244,184,96,0.4), 0 12px 40px -8px rgba(244,184,96,0.55)",
              }}>
                ▸ &nbsp;Start story
              </Link>
              <Link href="/onboarding" style={{
                padding: "16px 26px",
                background: "transparent", color: "var(--paper)", textDecoration: "none",
                border: "1px solid var(--ink-3)", display: "inline-block",
                borderRadius: 99,
                fontSize: 15, fontWeight: 500,
              }}>
                Add a clone
              </Link>
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
        <Section eyebrow="Pick up where you stopped" title={<>Tonight, on the <span className="serif-italic">moon-side</span>.</>} action={<Link href="/browse" style={{ color: "var(--lamp-soft)", fontSize: 13, textDecoration: "none" }}>Browse the library →</Link>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {STORIES.map(s => (
              <Link key={s.id} href="/browse" style={{
                textAlign: "left", display: "block", width: "100%", textDecoration: "none",
                background: "var(--ink-2)", border: "1px solid var(--ink-3)",
                borderRadius: 20, overflow: "hidden", padding: 0
              }}>
                <StoryArt kind={s.art} color={s.color} height={170} />
                <div style={{ padding: 18 }}>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--paper-mute)", marginBottom: 8 }}>
                    {s.series} · Ep {s.ep}
                  </div>
                  <h3 className="serif" style={{ fontSize: 22, margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em", color: "var(--paper)" }}>
                    {s.title}
                  </h3>
                  <div style={{ display: "flex", gap: 10, marginTop: 14, fontSize: 12, color: "var(--paper-dim)" }}>
                    <Pill>{s.mins} min</Pill>
                    <Pill>Ages {s.ages}</Pill>
                    <Pill subtle>{s.tone}</Pill>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Section>

        {/* The Family Tree strip */}
        <Section eyebrow="Your Family Tree" title={<>Four <span className="serif-italic">familiar</span> clones, ready.</>} action={<Link href="/dashboard/family" style={{ color: "var(--lamp-soft)", fontSize: 13, textDecoration: "none" }}>Manage family →</Link>}>
          <FamilyTreeStrip />
        </Section>
      </div>
    </TwilightShell>
  );
}

function Stat({ n, l }: { n: string, l: string }) {
  return (
    <div>
      <div className="serif" style={{ fontSize: 32, lineHeight: 1, color: "var(--paper)" }}>{n}</div>
      <div style={{ fontSize: 11, marginTop: 4, letterSpacing: "0.05em" }}>{l}</div>
    </div>
  );
}

function Pill({ children, subtle }: { children: React.ReactNode, subtle?: boolean }) {
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 99, fontSize: 11,
      background: subtle ? "transparent" : "rgba(244,236,219,0.06)",
      border: subtle ? "1px solid var(--ink-3)" : "1px solid transparent",
      color: "var(--paper-dim)",
    }}>{children}</span>
  );
}

function HeroLamp({ playing, onToggle, cloneIdx, setCloneIdx }: { playing: boolean, onToggle: () => void, cloneIdx: number, setCloneIdx: (i: number) => void }) {
  const clone = CLONES[cloneIdx % CLONES.length];
  return (
    <div style={{ position: "relative", aspectRatio: "1/1.05" }}>
      <div style={{
        position: "absolute", inset: -40,
        background: "radial-gradient(circle at 50% 35%, rgba(244,184,96,0.32), transparent 55%)",
        animation: playing ? "lampPulse 4s ease-in-out infinite" : "none",
        pointerEvents: "none",
      }} />

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

          {[110, 88, 66, 44, 22].map((r, i) => (
            <path key={i}
              d={`M${160 - r} 220 A${r} ${r} 0 0 1 ${160 + r} 220`}
              stroke="#F4ECDB" strokeWidth={2 + i * 0.3}
              opacity={playing ? 0.2 + i * 0.18 : 0.12 + i * 0.1}
              fill="none" strokeLinecap="round"
              style={{
                transformOrigin: "160px 220px",
                animation: playing ? `ripple-${i} ${3.2 + i * 0.4}s ease-in-out infinite` : "none",
              }}
            />
          ))}

          <circle cx="160" cy="60" r="6" fill="#F4ECDB" />
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

      <div style={{
        position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)",
        width: "min(380px, 90%)", background: "var(--ink-2)", border: "1px solid var(--ink-3)",
        borderRadius: 22, padding: 18, boxShadow: "0 24px 60px -16px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Avatar name={clone.name} color={clone.color} size={44} ring />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--paper-mute)", textTransform: "uppercase" }}>
              Now reading
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--paper)" }}>
              {clone.name} <span style={{ color: "var(--paper-mute)", fontWeight: 400 }}>· The Moon Who Forgot to Sleep</span>
            </div>
          </div>
          <button onClick={onToggle} style={{
            width: 36, height: 36, borderRadius: 99, background: "var(--lamp)", color: "var(--ink-0)",
            border: 0, cursor: "pointer", fontSize: 12, fontWeight: 700,
          }}>
            {playing ? "❚❚" : "▸"}
          </button>
        </div>
        <Waveform playing={playing} count={42} height={28} color={clone.color} />
        <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
          {CLONES.slice(0, 4).map((v, i) => (
            <button key={v.id} onClick={() => setCloneIdx(i)}
              style={{
                flex: 1, padding: "6px 8px",
                background: i === cloneIdx ? "rgba(244,184,96,0.14)" : "transparent",
                border: `1px solid ${i === cloneIdx ? "rgba(244,184,96,0.35)" : "var(--ink-3)"}`,
                borderRadius: 8, fontSize: 11, color: i === cloneIdx ? "var(--lamp-soft)" : "var(--paper-mute)",
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

function FamilyTreeStrip() {
  const connectionPath = "M50 12 L50 35 L12 35 L12 55 M50 35 L37 35 L37 55 M50 35 L63 35 L63 55 M50 35 L88 35 L88 55";

  return (
    <div style={{
      position: "relative", background: "var(--ink-1)", border: "1px solid var(--ink-3)",
      borderRadius: 24, padding: "40px 36px 36px", overflow: "hidden",
    }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} preserveAspectRatio="none" viewBox="0 0 100 100">
        <path d={connectionPath}
              stroke="rgba(244,236,219,0.12)" strokeWidth="0.25" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 32, position: "relative", zIndex: 2 }}>
        <div className="mono" style={{
          padding: "6px 14px", background: "var(--ink-2)", border: "1px solid var(--ink-3)",
          borderRadius: 99, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
          color: "var(--paper-dim)",
        }}>
          The Khan Family · Est. 2017
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, position: "relative", zIndex: 2 }}>
        {CLONES.map(v => (
          <CloneFullCard key={v.id} clone={v} href="/dashboard/family" />
        ))}
      </div>
    </div>
  );
}
