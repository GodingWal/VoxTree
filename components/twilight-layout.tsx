"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { VoxMark, VoxWordmark } from './voxtree-logo';

export function TwilightShell({ children }: { children: React.ReactNode }) {
  // Ensure the body has the starfield data attribute
  useEffect(() => {
    document.body.dataset.starfield = "on";
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar />
      <div style={{ flex: 1, position: "relative" }}>{children}</div>
      <Footer />
    </div>
  );
}

import { createClient } from "@/lib/supabase/client";
import { getAmbientSynth } from "@/lib/ambient-synth";
import { Volume2, VolumeX } from "lucide-react";

function TopBar() {
  const pathname = usePathname();
  const [initials, setInitials] = React.useState("U");
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<any>(null);
  const supabase = createClient();

  // Bedtime reactive states
  const [bedtimeAudio, setBedtimeAudio] = React.useState<string>("none");
  const [isAmbientPlaying, setIsAmbientPlaying] = React.useState(false);

  const applyAutodim = (cfg: { time: string; autodim: boolean; audio: string }) => {
    if (!cfg.autodim) {
      document.body.style.filter = "";
      document.body.style.transition = "";
      return;
    }
    const [bh, bm] = cfg.time.split(":").map(Number);
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const bedtimeMin = bh * 60 + bm;

    // Bedtime is active from bedtime hour until 6:00 AM
    const isBedtimeActive = currentMin >= bedtimeMin || currentMin < 6 * 60;

    document.body.style.transition = "filter 1.5s ease-in-out";
    if (isBedtimeActive) {
      document.body.style.filter = "brightness(0.7) contrast(1.05) saturate(0.9)";
    } else {
      document.body.style.filter = "";
    }
  };

  const fetchBedtimeSettings = async (userId: string) => {
    const localKey = `sim_bedtime_user_${userId}`;
    const stored = localStorage.getItem(localKey);
    let config = { time: "21:00", autodim: true, audio: "soft_rain" };

    if (stored) {
      config = JSON.parse(stored);
    } else {
      try {
        const { data } = await supabase
          .from("users")
          .select("bedtime_time, bedtime_autodim, default_background_audio")
          .eq("id", userId)
          .single();
        if (data) {
          config = {
            time: data.bedtime_time || "21:00",
            autodim: data.bedtime_autodim !== false,
            audio: data.default_background_audio || "soft_rain"
          };
          localStorage.setItem(localKey, JSON.stringify(config));
        }
      } catch (err) {}
    }

    setBedtimeAudio(config.audio);
    applyAutodim(config);

    // Auto-play ambient sound past bedtime hours if enabled
    const [bh, bm] = config.time.split(":").map(Number);
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const bedtimeMin = bh * 60 + bm;
    const isPastBedtime = currentMin >= bedtimeMin || currentMin < 6 * 60;

    if (isPastBedtime && config.audio !== "none") {
      try {
        const synth = getAmbientSynth();
        synth.setSound(config.audio as any);
        synth.setVolume(0.3); // soft volume for active reading
        setIsAmbientPlaying(true);
      } catch (err) {}
    }
  };

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        const email = data.session.user.email || "";
        const name = data.session.user.user_metadata?.full_name || email.split("@")[0] || "User";
        setInitials(name.substring(0, 2).toUpperCase());

        // Load bedtime configurations
        fetchBedtimeSettings(data.session.user.id);

        // Fetch avatar_url from public.users table
        const fetchAvatar = async () => {
          try {
            const { data: profile } = await supabase
              .from("users")
              .select("avatar_url")
              .eq("id", data.session.user.id)
              .single();
            if (profile?.avatar_url) {
              setAvatarUrl(profile.avatar_url);
            } else {
              const simulated = localStorage.getItem(`sim_avatar_user_${data.session.user.id}`);
              if (simulated) setAvatarUrl(simulated);
            }
          } catch (err) {
            console.warn("Failed to fetch user avatar in TopBar", err);
            const simulated = localStorage.getItem(`sim_avatar_user_${data.session.user.id}`);
            if (simulated) setAvatarUrl(simulated);
          }
        };
        fetchAvatar();
      }
    });
  }, []);

  // Listen to custom settings update events to dynamically adapt UI
  React.useEffect(() => {
    const handleUpdate = (e: any) => {
      const config = e.detail;
      if (config) {
        setBedtimeAudio(config.audio);
        if (config.audio === "none") {
          getAmbientSynth().stop();
          setIsAmbientPlaying(false);
        }
        applyAutodim(config);
      }
    };
    window.addEventListener("bedtime-settings-updated", handleUpdate);
    return () => window.removeEventListener("bedtime-settings-updated", handleUpdate);
  }, []);

  // Periodically check auto-dim status every 30 seconds
  React.useEffect(() => {
    if (!session?.user) return;
    const localKey = `sim_bedtime_user_${session.user.id}`;
    const interval = setInterval(() => {
      const stored = localStorage.getItem(localKey);
      if (stored) {
        applyAutodim(JSON.parse(stored));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [session]);

  const items = [
    { id: "home",    label: "Home", href: "/" },
    { id: "library", label: "Library", href: "/browse" },
    { id: "stories", label: "Stories", href: "/dashboard/stories" },
    { id: "videos",  label: "Videos", href: "/videos" },
    { id: "clone",   label: "Clone", href: "/dashboard/clones" },
    { id: "family",  label: "Family", href: "/dashboard/family" },
  ];

  const soundLabels: Record<string, string> = {
    none: "Silent",
    white_noise: "Brown Noise",
    soft_rain: "Rain",
    ocean_waves: "Ocean",
    forest_night: "Crickets"
  };

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
        <Link href="/" style={{
          background: "none", border: 0, padding: 0, cursor: "pointer", color: "inherit", textDecoration: "none"
        }}>
          <VoxWordmark size={18} animate={false} />
        </Link>

        <nav style={{ display: "flex", gap: 4 }}>
          {items.map(it => {
            const isActive = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
            return (
              <Link key={it.id}
                href={it.href}
                style={{
                  padding: "8px 16px",
                  background: isActive ? "rgba(244,184,96,0.12)" : "transparent",
                  color: isActive ? "var(--lamp-soft)" : "var(--paper-dim)",
                  border: 0, borderRadius: 99,
                  fontSize: 14, fontWeight: 500, cursor: "pointer",
                  transition: "all .2s ease",
                  textDecoration: "none"
                }}>
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Ambient sound controller */}
          {session && bedtimeAudio !== "none" && (
            <button
              onClick={async () => {
                const synth = getAmbientSynth();
                if (isAmbientPlaying) {
                  synth.stop();
                  setIsAmbientPlaying(false);
                } else {
                  await synth.setSound(bedtimeAudio as any);
                  synth.setVolume(0.3);
                  setIsAmbientPlaying(true);
                }
              }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 14px",
                background: isAmbientPlaying ? "rgba(127,196,164,0.1)" : "transparent",
                color: isAmbientPlaying ? "var(--moss)" : "var(--paper-dim)",
                border: isAmbientPlaying ? "1px solid rgba(127,196,164,0.3)" : "1px solid var(--ink-3)",
                borderRadius: 99, fontSize: 13, cursor: "pointer",
                transition: "all 0.2s"
              }}
              title={isAmbientPlaying ? "Pause ambient sound" : "Play ambient sound"}
            >
              {isAmbientPlaying ? <Volume2 size={14} className="animate-pulse" /> : <VolumeX size={14} />}
              <span className="mono" style={{ fontSize: 11 }}>Ambient: {soundLabels[bedtimeAudio]}</span>
            </button>
          )}

          {session ? (
            <>
              <button style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 14px",
                background: "transparent",
                color: "var(--paper-dim)",
                border: "1px solid var(--ink-3)",
                borderRadius: 99, fontSize: 13, cursor: "pointer",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--moss)" }} />
                Connected
              </button>
              <Link href="/dashboard/settings" style={{
                width: 36,
                height: 36,
                borderRadius: 99,
                border: "2px solid #e29578",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                fontSize: 13,
                overflow: "hidden",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.15)",
              }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(135deg, var(--rose), var(--lamp))",
                    color: "var(--ink-0)",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {initials}
                  </div>
                )}
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
            </>
          ) : (
            <Link href="/login" style={{
              padding: "8px 16px",
              background: "var(--lamp)",
              color: "var(--ink-0)",
              border: 0, borderRadius: 99, fontSize: 14, fontWeight: 600, textDecoration: "none",
            }}>
              Log In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
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
          <Link href="/privacy" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="hover-lamp">Privacy</Link>
          <Link href="/consent" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="hover-lamp">Consent</Link>
          <Link href="/help" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="hover-lamp">Help</Link>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}
