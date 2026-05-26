"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { TwilightShell } from "@/components/twilight-layout";
import { Play, Sparkles, Clock, Cpu, Check, Mail, ArrowRight, Award } from "lucide-react";

export default function VideosComingSoonPage() {
  const [email, setEmail] = useState("");
  const [signedUp, setSignedUp] = useState(false);
  const [playingPreview, setPlayingPreview] = useState(false);
  const [votes, setVotes] = useState<Record<string, number>>({
    lipSync: 124,
    choicePaths: 89,
    ambientGlow: 215,
    customStyling: 156
  });
  const [votedKeys, setVotedKeys] = useState<string[]>([]);

  useEffect(() => {
    // Load local storage votes
    const storedVotes = localStorage.getItem("vox_video_votes");
    const storedVotedKeys = localStorage.getItem("vox_video_voted_keys");
    if (storedVotes) setVotes(JSON.parse(storedVotes));
    if (storedVotedKeys) setVotedKeys(JSON.parse(storedVotedKeys));
  }, []);

  const handleVote = (key: string) => {
    if (votedKeys.includes(key)) return;
    const newVotes = { ...votes, [key]: votes[key] + 1 };
    const newVotedKeys = [...votedKeys, key];
    setVotes(newVotes);
    setVotedKeys(newVotedKeys);
    localStorage.setItem("vox_video_votes", JSON.stringify(newVotes));
    localStorage.setItem("vox_video_voted_keys", JSON.stringify(newVotedKeys));
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSignedUp(true);
    localStorage.setItem("vox_video_newsletter_email", email);
  };

  return (
    <TwilightShell>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 80px" }}>
        {/* Header Hero */}
        <div style={{ textAlign: "center", marginBottom: 56 }} className="fadeUp">
          <div className="mono" style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: 8, 
            fontSize: 11, 
            letterSpacing: "0.15em", 
            textTransform: "uppercase", 
            color: "var(--lamp)", 
            marginBottom: 20 
          }}>
            <Sparkles size={14} />
            Sneak Peek · Videos coming soon
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(44px, 6vw, 80px)", margin: "0 auto 18px", letterSpacing: "-0.02em", maxWidth: 900, lineHeight: 1.05 }}>
            Bedtime stories,<br/>
            <span className="serif-italic" style={{ color: "var(--lamp)" }}>brought to life.</span>
          </h1>
          <p style={{ color: "var(--paper-dim)", fontSize: 18, maxWidth: 600, margin: "0 auto", lineHeight: 1.55 }}>
            We are designing the next generation of voice-cloned cinema. Animate bedtime worlds dynamically synced with your clone's narrator cadence.
          </p>
        </div>

        {/* Video Player and details column */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 40, marginBottom: 72 }} className="md:grid-cols-[1.3fr_1fr] fadeUp">
          
          {/* Left: Cinematic mock player */}
          <div style={{
            background: "var(--ink-1)",
            border: "1px solid var(--ink-3)",
            borderRadius: 28,
            padding: 16,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}>
            <div style={{
              width: "100%",
              aspectRatio: "16/9",
              background: "#050711",
              borderRadius: 20,
              overflow: "hidden",
              position: "relative",
              border: "1px solid rgba(244,236,219,0.03)",
            }}>
              {/* Background preview image */}
              <Image
                src="/mock_pixar_character.png"
                alt="Widescreen Preview"
                fill
                sizes="(max-width: 768px) 100vw, 800px"
                style={{
                  objectFit: "cover",
                  opacity: playingPreview ? 0.9 : 0.45,
                  filter: playingPreview ? "none" : "blur(2px) grayscale(20%)",
                  transform: playingPreview ? "scale(1.05)" : "scale(1.0)",
                  transition: "transform 4s ease, filter 0.5s ease, opacity 0.5s ease",
                }}
              />

              {/* Ambient overlay glow when playing */}
              {playingPreview && (
                <div 
                  className="absolute inset-0 pointer-events-none" 
                  style={{
                    background: "radial-gradient(circle, transparent 40%, rgba(244,184,96,0.15) 100%)",
                    animation: "lampPulse 3s ease-in-out infinite"
                  }}
                />
              )}

              {/* Central Play button */}
              {!playingPreview ? (
                <button 
                  onClick={() => setPlayingPreview(true)}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 76,
                    height: 76,
                    borderRadius: 99,
                    background: "var(--lamp)",
                    color: "var(--ink-0)",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 8px 32px rgba(244,184,96,0.3)",
                    transition: "transform 0.2s ease, opacity 0.2s ease",
                  }}
                  className="hover:scale-105 active:scale-95"
                >
                  <Play size={32} fill="currentColor" style={{ marginLeft: 4 }} />
                </button>
              ) : (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: 20,
                  background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 40%)"
                }}>
                  {/* Top header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mono" style={{ fontSize: 9, background: "var(--rose)", color: "#000", fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>
                      DEMO LOOP
                    </span>
                    <button 
                      onClick={() => setPlayingPreview(false)}
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        border: "none",
                        color: "#fff",
                        borderRadius: 99,
                        padding: "4px 12px",
                        fontSize: 11,
                        cursor: "pointer",
                        backdropFilter: "blur(4px)"
                      }}
                    >
                      Stop Preview
                    </button>
                  </div>

                  {/* Waveform and progress */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", gap: 2, height: 16, width: 80 }}>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} style={{
                          flex: 1,
                          height: "100%",
                          background: "var(--lamp)",
                          borderRadius: 99,
                          animation: `barWave ${0.6 + (i % 4) * 0.15}s ease-in-out infinite alternate`,
                          animationDelay: `${i * 0.04}s`
                        }} />
                      ))}
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: "var(--paper)" }}>
                      Generative Lip Sync active · Grandma Rose voice
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: "20px 8px 4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <span className="serif" style={{ fontSize: 20, color: "var(--paper)" }}>
                  The Moon Who Forgot to Sleep — Scene Preview
                </span>
                <span className="mono" style={{ fontSize: 11, color: "var(--paper-mute)" }}>
                  Estimated Generation time: 45s
                </span>
              </div>
            </div>
          </div>

          {/* Right: Feature Spec list & Newsletter sign up */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* 1. Core Tech Spec list */}
            <div style={{
              background: "var(--ink-2)",
              border: "1px solid var(--ink-3)",
              borderRadius: 24,
              padding: 28,
            }}>
              <h3 className="serif" style={{ fontSize: 22, color: "var(--paper)", margin: "0 0 16px 0" }}>Cinematic Capabilities</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Cpu size={16} style={{ color: "var(--lamp-soft)", marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontSize: 14, color: "var(--paper)", margin: 0, fontWeight: 600 }}>Generative Video Diffusion</h4>
                    <p style={{ fontSize: 12, color: "var(--paper-dim)", margin: "2px 0 0 0", lineHeight: 1.4 }}>
                      Create rich Pixar-inspired bedtime worlds on the fly, customized to your child's favorite characters.
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Award size={16} style={{ color: "var(--moss)", marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontSize: 14, color: "var(--paper)", margin: 0, fontWeight: 600 }}>Perfect Lip Synchronization</h4>
                    <p style={{ fontSize: 12, color: "var(--paper-dim)", margin: "2px 0 0 0", lineHeight: 1.4 }}>
                      AI animation loops that match your clone's reading rhythm and lip movement dynamically.
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Clock size={16} style={{ color: "var(--rose)", marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontSize: 14, color: "var(--paper)", margin: 0, fontWeight: 600 }}>Soothing Bedtime Cadence</h4>
                    <p style={{ fontSize: 12, color: "var(--paper-dim)", margin: "2px 0 0 0", lineHeight: 1.4 }}>
                      Framerate and animations transition smoothly down into static low-frequency tones as the story nears its end.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Newsletter Sign Up */}
            <div style={{
              background: "var(--ink-1)",
              border: "1px solid var(--ink-3)",
              borderRadius: 24,
              padding: 28,
            }}>
              {!signedUp ? (
                <>
                  <h3 className="serif" style={{ fontSize: 22, color: "var(--paper)", margin: "0 0 8px 0" }}>Be first to test</h3>
                  <p style={{ fontSize: 13, color: "var(--paper-dim)", margin: "0 0 20px 0", lineHeight: 1.4 }}>
                    Join the private beta. We'll send you an invitation once video generations open in your account area.
                  </p>
                  <form onSubmit={handleSignUp} style={{ display: "flex", background: "var(--ink-2)", border: "1px solid var(--ink-3)", borderRadius: 16, padding: 6 }}>
                    <input 
                      type="email" 
                      placeholder="Your email address" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#fff",
                        padding: "10px 14px",
                        fontSize: 14,
                        flex: 1,
                        outline: "none",
                      }}
                    />
                    <button 
                      type="submit" 
                      style={{
                        background: "var(--lamp)",
                        border: "none",
                        color: "var(--ink-0)",
                        borderRadius: 12,
                        padding: "10px 18px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      Beta Invite <ArrowRight size={14} />
                    </button>
                  </form>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 99,
                    background: "rgba(127,196,164,0.1)",
                    color: "var(--moss)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px"
                  }}>
                    <Check size={24} />
                  </div>
                  <h3 className="serif" style={{ fontSize: 22, color: "var(--paper)", margin: "0 0 6px 0" }}>You are on the list!</h3>
                  <p style={{ fontSize: 13, color: "var(--paper-dim)", margin: 0 }}>
                    We'll email you a developer invitation link at <span className="mono" style={{ color: "#fff" }}>{email}</span> soon.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Feature roadmap voting grid */}
        <div style={{ marginTop: 40 }} className="fadeUp">
          <div style={{ marginBottom: 24 }}>
            <h3 className="serif" style={{ fontSize: 28, color: "var(--paper)", margin: 0 }}>Shape the Video Roadmap</h3>
            <p style={{ color: "var(--paper-dim)", fontSize: 14, margin: "6px 0 0 0" }}>
              Which video synthesis capability matters most for your bedtime routines? Vote for your top feature.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            <RoadmapCard 
              vKey="lipSync" 
              title="Voice-Synced Lip Movement" 
              desc="Avatars move their lips in sync with cloned audio, matching vowels and narrator pacing." 
              votes={votes.lipSync} 
              voted={votedKeys.includes("lipSync")}
              onVote={() => handleVote("lipSync")}
            />
            <RoadmapCard 
              vKey="choicePaths" 
              title="Interactive Branching Clips" 
              desc="Kids can select choices at intervals during the video, steering the story script dynamically." 
              votes={votes.choicePaths} 
              voted={votedKeys.includes("choicePaths")}
              onVote={() => handleVote("choicePaths")}
            />
            <RoadmapCard 
              vKey="ambientGlow" 
              title="Smart Ambient Projector Glow" 
              desc="Video cast colors project soft dynamic illumination back onto the screen layout, acting as a nightlight." 
              votes={votes.ambientGlow} 
              voted={votedKeys.includes("ambientGlow")}
              onVote={() => handleVote("ambientGlow")}
            />
            <RoadmapCard 
              vKey="customStyling" 
              title="Watercolor & Sketch Styles" 
              desc="Allow rendering video diffusions as watercolor illustrations or hand-drawn pencil sketches." 
              votes={votes.customStyling} 
              voted={votedKeys.includes("customStyling")}
              onVote={() => handleVote("customStyling")}
            />
          </div>
        </div>
      </div>
    </TwilightShell>
  );
}

function RoadmapCard({ vKey, title, desc, votes, voted, onVote }: { vKey: string; title: string; desc: string; votes: number; voted: boolean; onVote: () => void }) {
  return (
    <div style={{
      background: "var(--ink-2)",
      border: voted ? "1px solid rgba(127,196,164,0.4)" : "1px solid var(--ink-3)",
      borderRadius: 20,
      padding: 24,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      minHeight: 180,
      boxShadow: voted ? "0 0 15px rgba(127,196,164,0.05)" : "none",
      transition: "border-color 0.2s"
    }}>
      <div>
        <h4 className="serif" style={{ fontSize: 17, color: "var(--paper)", margin: "0 0 8px 0" }}>{title}</h4>
        <p style={{ fontSize: 12, color: "var(--paper-dim)", margin: 0, lineHeight: 1.45 }}>{desc}</p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <span className="mono" style={{ fontSize: 11, color: voted ? "var(--moss)" : "var(--paper-mute)" }}>
          {votes} {votes === 1 ? "vote" : "votes"}
        </span>
        <button 
          onClick={onVote}
          disabled={voted}
          style={{
            padding: "6px 14px",
            background: voted ? "rgba(127,196,164,0.12)" : "transparent",
            color: voted ? "var(--moss)" : "var(--lamp-soft)",
            border: voted ? "1px solid rgba(127,196,164,0.2)" : "1px solid var(--ink-3)",
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 600,
            cursor: voted ? "default" : "pointer",
            transition: "all 0.15s ease"
          }}
          className={voted ? "" : "hover:border-lamp/30 hover:bg-lamp/5"}
        >
          {voted ? "✓ Voted" : "Vote"}
        </button>
      </div>
    </div>
  );
}
