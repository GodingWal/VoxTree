"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TwilightShell } from "@/components/twilight-layout";
import { Section } from "@/components/twilight-ui";
import { updateBedtimeSettings } from "./actions";
import { getAmbientSynth, type AmbientSoundType } from "@/lib/ambient-synth";
import { Loader2, ArrowLeft, Moon, Sun, Volume2, VolumeX, ShieldCheck, Play, Square, AlertCircle } from "lucide-react";

interface BedtimeClientProps {
  userId: string;
  initialTime: string;
  initialAutodim: boolean;
  initialAudio: string;
  dbSimulated: boolean;
}

export function BedtimeClient({
  userId,
  initialTime,
  initialAutodim,
  initialAudio,
  dbSimulated
}: BedtimeClientProps) {
  const router = useRouter();
  const [time, setTime] = useState(initialTime);
  const [autodim, setAutodim] = useState(initialAutodim);
  const [audio, setAudio] = useState<AmbientSoundType>(initialAudio as AmbientSoundType);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(dbSimulated);

  // Audio preview playing state
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Initialize from localStorage if simulation is active
  useEffect(() => {
    const localKey = `sim_bedtime_user_${userId}`;
    const stored = localStorage.getItem(localKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      setTime(parsed.time || "21:00");
      setAutodim(parsed.autodim !== false);
      setAudio((parsed.audio || "soft_rain") as AmbientSoundType);
      setIsSimulating(true);
    } else if (dbSimulated) {
      setIsSimulating(true);
    }
  }, [userId, dbSimulated]);

  // Clean up audio preview when leaving the page or changing sound selection
  useEffect(() => {
    return () => {
      getAmbientSynth().stop();
    };
  }, []);

  const handleSoundChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSound = e.target.value as AmbientSoundType;
    setAudio(newSound);
    
    // Stop any active preview on selection change
    if (isPreviewPlaying) {
      getAmbientSynth().stop();
      setIsPreviewPlaying(false);
    }
  };

  const toggleSoundPreview = async () => {
    try {
      if (isPreviewPlaying) {
        getAmbientSynth().stop();
        setIsPreviewPlaying(false);
      } else {
        await getAmbientSynth().setSound(audio);
        getAmbientSynth().setVolume(0.5); // set comfortable preview volume
        setIsPreviewPlaying(true);
      }
    } catch (err) {
      console.error("Audio preview failed", err);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    // Stop any active preview
    getAmbientSynth().stop();
    setIsPreviewPlaying(false);

    const config = { time, autodim, audio };

    if (isSimulating) {
      const localKey = `sim_bedtime_user_${userId}`;
      localStorage.setItem(localKey, JSON.stringify(config));
      
      // Dispatch custom event to notify TwilightShell to adapt
      window.dispatchEvent(new CustomEvent("bedtime-settings-updated", { detail: config }));
      
      setSuccess(true);
      setLoading(false);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
      return;
    }

    // Database mode
    const formData = new FormData();
    formData.append("time", time);
    formData.append("autodim", autodim ? "true" : "false");
    formData.append("audio", audio);

    try {
      const res = await updateBedtimeSettings(formData);
      if (res.success) {
        // Store locally too for instant sync across tabs/shell
        const localKey = `sim_bedtime_user_${userId}`;
        localStorage.setItem(localKey, JSON.stringify(config));

        // Dispatch custom event to notify TwilightShell to adapt
        window.dispatchEvent(new CustomEvent("bedtime-settings-updated", { detail: config }));

        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        router.refresh();
      } else {
        setError(res.error || "Failed to update bedtime settings.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TwilightShell>
      <div style={{ maxWidth: 840, margin: "48px auto 96px", padding: "0 24px" }}>
        
        {/* Back Link */}
        <Link
          href="/dashboard/family"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--paper-dim)",
            textDecoration: "none",
            fontSize: 14,
            marginBottom: 32,
            transition: "color 0.2s"
          }}
          className="hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to Family Tree
        </Link>

        {/* Page Header */}
        <div style={{ marginBottom: 48 }} className="fadeUp">
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
            Family settings
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(36px, 5vw, 56px)", margin: "0 0 12px 0", color: "var(--paper)", letterSpacing: "-0.02em" }}>
            Bedtime & <span className="serif-italic" style={{ color: "var(--lamp)" }}>Ambient</span>
          </h1>
          <p style={{ color: "var(--paper-dim)", fontSize: 15, maxWidth: 540, lineHeight: 1.5, margin: 0 }}>
            Configure automatic night filters to soothe children's eyes and loop dynamic ambient sounds during narration playbacks.
          </p>
        </div>

        {isSimulating && (
          <div style={{
            background: "rgba(244, 184, 96, 0.06)", border: "1px solid rgba(244, 184, 96, 0.18)",
            borderRadius: 16, padding: "16px 20px", display: "flex", gap: 12, alignItems: "flex-start",
            marginBottom: 36, color: "var(--lamp-soft)", fontSize: 13, lineHeight: 1.5
          }} className="fadeUp">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Simulation Mode:</strong> Bedtime settings are currently running in simulation mode. Changes are saved locally and will adapt the interface instantly. Pushing migrations applies them DB-wide.
            </div>
          </div>
        )}

        {error && (
          <div style={{
            background: "rgba(232,133,108,0.08)", border: "1px solid rgba(232,133,108,0.25)",
            borderRadius: 16, padding: 16, color: "var(--rose)", fontSize: 14,
            marginBottom: 32
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Content Box */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 40 }} className="fadeUp">
          
          <Section eyebrow="ATMOSPHERE ADJUSTMENTS" title={<>Bedtime <span className="serif-italic">Parameters</span></>}>
            <div style={{
              background: "var(--ink-2)", border: "1px solid var(--ink-3)",
              borderRadius: 24, padding: 36
            }}>
              <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                
                {/* 1. Bedtime Clock */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                  <label className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Daily Bedtime Hour
                  </label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    style={{
                      width: "200px", background: "var(--ink-1)", border: "1px solid var(--ink-3)",
                      borderRadius: 12, padding: "14px 16px", color: "var(--paper)", fontSize: 16, outline: "none"
                    }}
                  />
                  <p style={{ fontSize: 12, color: "var(--paper-mute)", margin: "4px 0 0" }}>
                    The target hour when bedtime routines are enforced for story limits.
                  </p>
                </div>

                {/* 2. Auto-dim Toggle */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, cursor: "pointer" }} onClick={() => setAutodim(!autodim)}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 4, border: "2px solid var(--ink-3)",
                    background: autodim ? "var(--lamp)" : "var(--ink-1)", display: "flex",
                    alignItems: "center", justifyContent: "center", cursor: "pointer",
                    transition: "all 0.2s", marginTop: 3, flexShrink: 0
                  }}>
                    {autodim && <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--ink-0)" }} />}
                  </div>
                  <div>
                    <label style={{ fontSize: 14, color: "var(--paper)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      {autodim ? <Moon size={14} style={{ color: "var(--lamp)" }} /> : <Sun size={14} style={{ color: "var(--paper-mute)" }} />}
                      Enable Ambient Screen Auto-Dim
                    </label>
                    <p style={{ fontSize: 12, color: "var(--paper-mute)", margin: "4px 0 0", lineHeight: 1.4 }}>
                      When enabled and local time is past your daily bedtime, VoxTree automatically dims screen brightness and increases contrast to protect children's eyes before sleep.
                    </p>
                  </div>
                </div>

                {/* 3. Ambient Background Audio Selector */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, borderTop: "1px solid var(--ink-3)", paddingTop: 28 }}>
                  <label className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Default Ambient Audio Loop
                  </label>
                  
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <select
                      value={audio}
                      onChange={handleSoundChange}
                      style={{
                        flex: 1, background: "var(--ink-1)", border: "1px solid var(--ink-3)",
                        borderRadius: 12, padding: "14px 16px", color: "var(--paper)", fontSize: 15, outline: "none",
                        cursor: "pointer"
                      }}
                    >
                      <option value="none">No Ambient Sound (Silent)</option>
                      <option value="white_noise">Soothing Brownian Noise</option>
                      <option value="soft_rain">Gentle Bedtime Rain</option>
                      <option value="ocean_waves">Rolling Ocean Waves</option>
                      <option value="forest_night">Summer Forest Crickets</option>
                    </select>

                    {/* Preview Button */}
                    {audio !== "none" && (
                      <button
                        type="button"
                        onClick={toggleSoundPreview}
                        style={{
                          padding: "14px 20px", borderRadius: 12,
                          background: isPreviewPlaying ? "var(--rose)" : "var(--ink-3)",
                          color: "var(--paper)", border: "1px solid var(--ink-3)",
                          cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                          fontWeight: 500, fontSize: 14, transition: "all 0.2s"
                        }}
                      >
                        {isPreviewPlaying ? (
                          <>
                            <Square size={14} fill="currentColor" />
                            Stop Preview
                          </>
                        ) : (
                          <>
                            <Play size={14} fill="currentColor" />
                            Preview Sound
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--paper-mute)", margin: "4px 0 0" }}>
                    This background sound loops softly in the background during story readings to create a relaxing atmosphere.
                  </p>
                </div>

                {/* Save Button & Feedback */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, borderTop: "1px solid var(--ink-3)", paddingTop: 28 }}>
                  <div>
                    {success && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--moss)", fontSize: 14 }}>
                        <ShieldCheck size={18} />
                        Settings saved and applied!
                      </div>
                    )}
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: "14px 32px", background: "var(--lamp)", color: "var(--ink-0)",
                      border: "none", borderRadius: 99, fontWeight: 600, fontSize: 14,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 8
                    }}
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      "Save Settings"
                    )}
                  </button>
                </div>

              </form>
            </div>
          </Section>

        </div>

      </div>
    </TwilightShell>
  );
}
