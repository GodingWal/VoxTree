"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CloneFullCard, Section } from "@/components/twilight-ui";
import { VoxMark } from "@/components/voxtree-logo";
import { 
  Volume2, 
  Activity, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  Cpu, 
  Music, 
  Mic, 
  FileCheck 
} from "lucide-react";

interface Clone {
  id: string;
  name: string;
  relation: string;
  recorded: string;
  status: string;
  lastUsed: string;
  stories: number;
  color: string;
  avatar_url: string | null;
}

export function ClonesClient({ clones }: { clones: Clone[] }) {
  const [activePlaying, setActivePlaying] = useState<{ voiceId: string; name: string } | null>(null);

  useEffect(() => {
    const handlePlayState = (e: any) => {
      const { voiceId, name, playing } = e.detail;
      if (playing) {
        setActivePlaying({ voiceId, name });
      } else {
        setActivePlaying(prev => prev?.voiceId === voiceId ? null : prev);
      }
    };
    window.addEventListener("clone-sample-state", handlePlayState);
    return () => window.removeEventListener("clone-sample-state", handlePlayState);
  }, []);

  // Determine dynamic SVG path for connection lines based on clones.length
  let connectionPath = "M50 22 L50 72"; // Default single straight line
  if (clones.length === 2) {
    connectionPath = "M50 22 L50 45 L35 45 L35 72 M50 45 L65 45 L65 72";
  } else if (clones.length === 3) {
    connectionPath = "M50 22 L50 45 L22 45 L22 72 M50 45 L50 72 M50 45 L78 45 L78 72";
  } else if (clones.length >= 4) {
    connectionPath = "M50 22 L50 45 L15 45 L15 72 M50 45 L38 45 L38 72 M50 45 L62 45 L62 72 M50 45 L85 45 L85 72";
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 24px" }}>
      {/* Header section */}
      <div className="fadeUp" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, gap: 24 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
            Your Clone
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0, letterSpacing: "-0.02em", color: "var(--paper)" }}>
            Clone,<br/><span className="serif-italic" style={{ color: "var(--lamp)" }}>read aloud.</span>
          </h1>
        </div>
        <Link href="/onboarding" style={{
          padding: "14px 22px",
          background: "var(--lamp)", color: "var(--ink-0)",
          border: 0, borderRadius: 99, textDecoration: "none",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
          transition: "transform 0.2s, opacity 0.2s",
        }} className="hover:opacity-90 active:scale-95">＋ &nbsp;Add a clone</Link>
      </div>

      {/* Interactive Statistics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, marginBottom: 40 }} className="fadeUp">
        <div style={{ background: "var(--ink-1)", border: "1px solid var(--ink-3)", borderRadius: 20, padding: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ padding: 12, background: "rgba(244,184,96,0.06)", borderRadius: 12 }}>
            <Cpu size={24} style={{ color: "var(--lamp-soft)" }} />
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Active Clones</div>
            <div className="serif" style={{ fontSize: 24, fontWeight: "bold", color: "var(--paper)", margin: 0, marginTop: 2 }}>{clones.length} models</div>
          </div>
        </div>
        <div style={{ background: "var(--ink-1)", border: "1px solid var(--ink-3)", borderRadius: 20, padding: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ padding: 12, background: "rgba(127,196,164,0.06)", borderRadius: 12 }}>
            <Music size={24} style={{ color: "var(--moss)" }} />
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Reads</div>
            <div className="serif" style={{ fontSize: 24, fontWeight: "bold", color: "var(--paper)", margin: 0, marginTop: 2 }}>0 reads</div>
          </div>
        </div>
        <div style={{ background: "var(--ink-1)", border: "1px solid var(--ink-3)", borderRadius: 20, padding: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ padding: 12, background: "rgba(232,133,108,0.06)", borderRadius: 12 }}>
            <ShieldCheck size={24} style={{ color: "var(--rose)" }} />
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Security Status</div>
            <div className="serif" style={{ fontSize: 24, fontWeight: "bold", color: "var(--paper)", margin: 0, marginTop: 2 }}>Biometrically Verified</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Tree Diagram, Right Voice Console */}
      <div className="clones-dashboard-grid fadeUp">
        {/* Left Column: Clones tree diagram */}
        <div style={{
          position: "relative",
          background: "var(--ink-1)", border: "1px solid var(--ink-3)",
          borderRadius: 28, padding: "48px 32px 56px",
          overflow: "hidden",
        }}>
          {/* connecting lines svg */}
          {clones.length > 0 && (
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} preserveAspectRatio="none" viewBox="0 0 100 100">
              <path d={connectionPath}
                    stroke="rgba(244,236,219,0.12)" strokeWidth="0.25" fill="none" vectorEffect="non-scaling-stroke" />
            </svg>
          )}

          {/* root */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 64, position: "relative", zIndex: 2 }}>
            <div style={{
              padding: "14px 24px",
              background: "var(--ink-2)",
              border: "1px solid rgba(244,184,96,0.35)",
              borderRadius: 99,
              display: "flex", alignItems: "center", gap: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            }}>
              <VoxMark size={28} color="var(--lamp)" />
              <div>
                <div className="serif" style={{ fontSize: 22, lineHeight: 1, color: "var(--paper)" }}>Your Clones</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>
                  {clones.length} {clones.length === 1 ? 'clone' : 'clones'} • 0 reads
                </div>
              </div>
            </div>
          </div>

          {clones.length > 0 ? (
            <div style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 28,
              position: "relative",
              zIndex: 2,
            }}>
              {clones.map(v => (
                <div key={v.id} style={{ width: "100%", maxWidth: 250 }}>
                  <CloneFullCard clone={v} href={`/dashboard/clones/${v.id}`} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "var(--paper-dim)", marginTop: 40, position: "relative", zIndex: 2 }}>
              No clones added yet. <Link href="/onboarding" style={{ color: "var(--lamp)" }}>Add your first clone →</Link>
            </div>
          )}
        </div>

        {/* Right Column: High-tech Voice Studio & Onboarding Progress */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 1. Real-Time Spectral Analyzer */}
          <div style={{
            background: "var(--ink-1)",
            border: activePlaying ? "1px solid rgba(244, 184, 96, 0.4)" : "1px solid var(--ink-3)",
            borderRadius: 24,
            padding: 24,
            transition: "border-color 0.3s ease, box-shadow 0.3s ease",
            boxShadow: activePlaying ? "0 0 20px rgba(244, 184, 96, 0.08)" : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={18} className={activePlaying ? "animate-pulse text-[var(--lamp)]" : "text-[var(--paper-mute)]"} />
                <h3 className="serif" style={{ fontSize: 18, color: "var(--paper)", margin: 0 }}>Voice Analyzer</h3>
              </div>
              {activePlaying ? (
                <span className="mono animate-pulse" style={{ fontSize: 9, background: "rgba(127,196,164,0.12)", color: "var(--moss)", padding: "3px 8px", borderRadius: 99, border: "1px solid rgba(127,196,164,0.2)" }}>
                  ACTIVE
                </span>
              ) : (
                <span className="mono" style={{ fontSize: 9, background: "rgba(244,236,219,0.06)", color: "var(--paper-mute)", padding: "3px 8px", borderRadius: 99 }}>
                  IDLE
                </span>
              )}
            </div>

            {/* Visualizer Waveform Block */}
            <div style={{
              height: 90,
              background: "#080c18",
              borderRadius: 16,
              border: "1px solid var(--ink-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 16px",
              position: "relative",
              overflow: "hidden",
              marginBottom: 16,
            }}>
              {activePlaying ? (
                <div style={{ display: "flex", alignItems: "center", gap: 3, height: 48, width: "100%" }}>
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} style={{
                      flex: 1,
                      height: `${30 + Math.abs(Math.sin(i * 1.5) * 70)}%`,
                      background: "linear-gradient(to top, var(--lamp), var(--rose))",
                      borderRadius: 99,
                      animation: `barWave ${0.5 + (i % 4) * 0.15}s ease-in-out infinite alternate`,
                      animationDelay: `${i * 0.03}s`
                    }} />
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 3, height: 4, width: "100%", opacity: 0.25 }}>
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} style={{
                      flex: 1,
                      height: 4,
                      background: "var(--paper-dim)",
                      borderRadius: 99,
                    }} />
                  ))}
                </div>
              )}
              {!activePlaying && (
                <div className="mono" style={{ position: "absolute", fontSize: 9, color: "var(--paper-mute)", letterSpacing: "0.08em" }}>
                  AWAITING AUDIO INPUT
                </div>
              )}
            </div>

            {/* Spec Sheet list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px dashed var(--ink-3)", paddingBottom: 8 }}>
                <span style={{ color: "var(--paper-mute)" }}>Stream Channel</span>
                <span className="mono" style={{ color: "var(--paper)" }}>
                  {activePlaying ? activePlaying.name : "None"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px dashed var(--ink-3)", paddingBottom: 8 }}>
                <span style={{ color: "var(--paper-mute)" }}>Model Version</span>
                <span className="mono" style={{ color: "var(--paper)" }}>Vox-Deep-TTS v2.5</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px dashed var(--ink-3)", paddingBottom: 8 }}>
                <span style={{ color: "var(--paper-mute)" }}>Latency</span>
                <span className="mono" style={{ color: "var(--paper)" }}>{activePlaying ? "112 ms" : "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--paper-mute)" }}>Spectral Match</span>
                <span className="mono" style={{ color: activePlaying ? "var(--moss)" : "var(--paper)" }}>
                  {activePlaying ? "99.8% Perfect" : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Synthesis Pipeline Status */}
          <div style={{
            background: "var(--ink-1)",
            border: "1px solid var(--ink-3)",
            borderRadius: 24,
            padding: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <ShieldCheck size={18} style={{ color: "var(--rose)" }} />
              <h3 className="serif" style={{ fontSize: 18, color: "var(--paper)", margin: 0 }}>Synthesis Pipeline</h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <PipelineStep index={1} label="Biometric Facemap Scan" status="complete" details="Pixar avatar generated from head sweeps" />
              <PipelineStep index={2} label="Acoustic Voice Check" status="complete" details="Voice check validated via teleprompter" />
              <PipelineStep index={3} label="Voice Training Capture" status="complete" details="1.5-minute custom cadence recording complete" />
              <PipelineStep index={4} label="Watermark & Encryption" status="complete" details="Synthetic audio encrypted with secure hash" />
            </div>
          </div>
        </div>
      </div>

      {/* Voice Quality Tips */}
      <Section eyebrow="cloning guides" title={<>Capture the <span className="serif-italic">perfect</span> clone</>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 40 }}>
          <div style={{ background: "var(--ink-2)", border: "1px solid var(--ink-3)", borderRadius: 16, padding: 24 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--lamp)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Acoustics</div>
            <h4 className="serif" style={{ fontSize: 18, color: "var(--paper)", margin: "0 0 8px 0" }}>Quiet Environment</h4>
            <p style={{ fontSize: 13, color: "var(--paper-dim)", margin: 0, lineHeight: 1.5 }}>
              Record in a quiet room with soft furnishings (carpets, curtains) to absorb echo and background hums.
            </p>
          </div>
          <div style={{ background: "var(--ink-2)", border: "1px solid var(--ink-3)", borderRadius: 16, padding: 24 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--moss)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Microphone</div>
            <h4 className="serif" style={{ fontSize: 18, color: "var(--paper)", margin: "0 0 8px 0" }}>Steady Distance</h4>
            <p style={{ fontSize: 13, color: "var(--paper-dim)", margin: 0, lineHeight: 1.5 }}>
              Keep a consistent distance of 4 to 6 inches from your microphone to prevent clipping or voice distortion.
            </p>
          </div>
          <div style={{ background: "var(--ink-2)", border: "1px solid var(--ink-3)", borderRadius: 16, padding: 24 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Pacing</div>
            <h4 className="serif" style={{ fontSize: 18, color: "var(--paper)", margin: "0 0 8px 0" }}>Natural Cadence</h4>
            <p style={{ fontSize: 13, color: "var(--paper-dim)", margin: 0, lineHeight: 1.5 }}>
              Read the prompt at a relaxed, slow bedtime story pace. Speak clearly and emphasize emotional intonations.
            </p>
          </div>
        </div>
      </Section>

      <style jsx global>{`
        .clones-dashboard-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 32px;
          margin-bottom: 56px;
        }
        @media (min-width: 1024px) {
          .clones-dashboard-grid {
            grid-template-columns: 1fr 340px;
          }
        }
      `}</style>
    </div>
  );
}

function PipelineStep({ index, label, status, details }: { index: number; label: string; status: "complete" | "processing" | "pending"; details: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ marginTop: 2 }}>
        <CheckCircle2 size={16} style={{ color: "var(--moss)" }} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>{label}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--paper-mute)", marginTop: 2 }}>{details}</div>
      </div>
    </div>
  );
}
