"use client";

import React, { useState, useRef } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Mic, Music, User as UserIcon, Activity, Sparkles, Camera, Play, Square, Loader2, ArrowLeft } from "lucide-react";
import { TrainSingingButton } from "@/components/train-singing-button";
import { DeleteCloneButton } from "@/components/delete-clone-button";
import { TestVoiceButton } from "@/components/test-voice-button";
import { Avatar, Waveform, Pill } from "@/components/twilight-ui";
import { VisualCloneCapture } from "@/components/visual-clone-capture";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface CloneDetailsTabsProps {
  voice: any;
  cloneColor: string;
  userId?: string;
}

export function CloneDetailsTabs({ voice, cloneColor, userId }: CloneDetailsTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("voice");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  React.useEffect(() => {
    if (voice.avatar_url) {
      setAvatarUrl(voice.avatar_url);
    } else {
      const simulated = localStorage.getItem(`sim_avatar_${voice.id}`);
      if (simulated) {
        setAvatarUrl(simulated);
      }
    }
  }, [voice.avatar_url, voice.id]);

  const [isCaptureOpen, setIsCaptureOpen] = useState(false);

  // Pixar Card Play State
  const [isTalking, setIsTalking] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePixarSample = async () => {
    if (isTalking && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsTalking(false);
      return;
    }

    setAudioLoading(true);
    try {
      const res = await fetch("/api/voices/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: voice.id }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate voice sample");
      }

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.simulated) {
          alert("Simulation Mode: Testing voice requires an active ElevenLabs API Key. (Audio disabled, speaking simulated for 3 seconds)");
          setAudioLoading(false);
          setIsTalking(true);
          setTimeout(() => setIsTalking(false), 3000);
          return;
        }
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsTalking(true);
        setAudioLoading(false);
      };

      audio.onended = () => {
        setIsTalking(false);
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        setIsTalking(false);
        setAudioLoading(false);
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.error("Failed to play voice sample:", err);
      alert("Error playing sample voice. Please try again.");
      setIsTalking(false);
      setAudioLoading(false);
    }
  };

  const handleCaptureSuccess = (newAvatarUrl: string) => {
    localStorage.setItem(`sim_avatar_${voice.id}`, newAvatarUrl);
    if (userId) {
      localStorage.setItem(`sim_avatar_user_${userId}`, newAvatarUrl);
    }
    setAvatarUrl(newAvatarUrl);
    setIsCaptureOpen(false);
    router.refresh();
  };

  return (
    <>
      {/* Back navigation */}
      <Link href="/dashboard/clones" className="inline-flex items-center gap-2 text-sm text-[var(--paper-dim)] hover:text-white transition-colors mb-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Clone Tree
      </Link>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[var(--ink-3)] pb-8 mb-6 mt-4">
        <div className="flex items-center gap-6">
          {avatarUrl ? (
            <div style={{
              width: 80,
              height: 80,
              borderRadius: 99,
              border: "3px solid #f4b860",
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
            }} className="flex-shrink-0">
              <img src="/mock_avatar.png" alt={voice.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <Avatar name={voice.name} color={cloneColor} size={80} ring />
          )}
          <div>
            <h1 className="text-5xl font-serif text-[var(--paper)] tracking-tight">
              {voice.name}
            </h1>
            <div className="flex items-center gap-3 mt-3">
              <Pill>Family Clone Model</Pill>
              <span className="text-sm text-[var(--paper-dim)] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--moss)]"></div>
                Connected
              </span>
            </div>
          </div>
        </div>
        <div className="w-32 md:w-48 opacity-60">
          <Waveform playing={isTalking} count={24} color={cloneColor} height={40} />
        </div>
      </div>

      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-8">
        <Tabs.List className="flex shrink-0 gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Tabs.Trigger
            value="voice"
            className="flex items-center gap-2 px-6 h-[40px] rounded-full text-sm font-medium text-[var(--paper-dim)] bg-transparent border border-transparent transition-all hover:bg-[var(--ink-2)] data-[state=active]:bg-[var(--ink-2)] data-[state=active]:text-white data-[state=active]:border-[var(--ink-3)] outline-none whitespace-nowrap"
          >
            <Mic className="h-4 w-4" />
            Standard Voice
          </Tabs.Trigger>
          <Tabs.Trigger
            value="singing"
            className="flex items-center gap-2 px-6 h-[40px] rounded-full text-sm font-medium text-[var(--paper-dim)] bg-transparent border border-transparent transition-all hover:bg-[var(--ink-2)] data-[state=active]:bg-[var(--ink-2)] data-[state=active]:text-white data-[state=active]:border-[var(--ink-3)] outline-none whitespace-nowrap"
          >
            <Music className="h-4 w-4" />
            Singing Voice
          </Tabs.Trigger>
          <Tabs.Trigger
            value="face"
            className="flex items-center gap-2 px-6 h-[40px] rounded-full text-sm font-medium text-[var(--paper-dim)] bg-transparent border border-transparent transition-all hover:bg-[var(--ink-2)] data-[state=active]:bg-[var(--ink-2)] data-[state=active]:text-white data-[state=active]:border-[var(--ink-3)] outline-none whitespace-nowrap"
          >
            <UserIcon className="h-4 w-4" />
            Visual Avatar
            {avatarUrl && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--lamp)]" />
            )}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="body"
            className="flex items-center gap-2 px-6 h-[40px] rounded-full text-sm font-medium text-[var(--paper-dim)] bg-transparent border border-transparent transition-all hover:bg-[var(--ink-2)] data-[state=active]:bg-[var(--ink-2)] data-[state=active]:text-white data-[state=active]:border-[var(--ink-3)] outline-none whitespace-nowrap"
          >
            <Activity className="h-4 w-4" />
            Full Body
          </Tabs.Trigger>
        </Tabs.List>

        {/* VOICE TAB */}
        <Tabs.Content value="voice" className="outline-none animate-in fade-in duration-300">
          <div className="rounded-[2rem] border border-[var(--ink-3)] bg-[var(--ink-1)] p-8 md:p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[var(--moss)]/10 to-transparent blur-3xl rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-8">
              <div className="space-y-4 max-w-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--moss)]/15 text-[var(--moss)] border border-[var(--moss)]/30">
                    <Mic className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-[var(--moss)]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--moss)] border border-[var(--moss)]/30">
                    Model Ready
                  </span>
                </div>
                <h3 className="font-serif text-3xl text-white">Standard Reading Voice</h3>
                <p className="text-lg text-[var(--paper-dim)] leading-relaxed">
                  This is the foundational voice clone used for reading bedtime stories, daily narrations, and custom text. It requires only 30 seconds of audio to maintain a high-quality likeness.
                </p>
              </div>

              <div className="flex flex-col gap-3 min-w-[200px]">
                <TestVoiceButton voiceId={voice.id} />
                <div className="w-full">
                  <DeleteCloneButton voiceId={voice.id} />
                </div>
              </div>
            </div>
          </div>
        </Tabs.Content>

        {/* SINGING TAB */}
        <Tabs.Content value="singing" className="outline-none animate-in fade-in duration-300">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[var(--lamp)]/20 bg-gradient-to-r from-[var(--lamp)]/10 to-transparent p-6 flex gap-4 items-start">
              <div className="rounded-full bg-[var(--lamp)]/20 p-2 text-[var(--lamp)] shrink-0">
                <Music className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--paper)] mb-1">
                  Advanced Voice-to-Voice (V2V) Model
                </h3>
                <p className="text-sm text-[var(--paper-dim)] leading-relaxed">
                  Standard cloning is excellent for reading, but true singing requires perfectly capturing pitch, vibrato, and melody. To create a Singing Voice, we use an advanced V2V model that requires <strong>5 to 10 minutes</strong> of clean audio.
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[var(--ink-3)] bg-[var(--ink-1)] p-8 md:p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[var(--lamp)]/10 to-transparent blur-3xl rounded-full pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-8">
                <div className="space-y-4 max-w-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ink-2)] text-white border border-[var(--ink-3)]">
                      <Music className="h-5 w-5" />
                    </div>
                    {voice.rvc_training_status === "ready" ? (
                      <span className="rounded-full bg-[var(--moss)]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--moss)] border border-[var(--moss)]/30">
                        Model Ready
                      </span>
                    ) : voice.rvc_training_status === "processing" ? (
                      <span className="rounded-full bg-[var(--lamp)]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--lamp)] border border-[var(--lamp)]/30">
                        Training...
                      </span>
                    ) : (
                      <span className="rounded-full bg-[var(--ink-2)] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--paper-dim)] border border-[var(--ink-3)]">
                        Not Trained
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-3xl text-white">Singing Model</h3>
                  <p className="text-lg text-[var(--paper-dim)] leading-relaxed">
                    Train this model to allow this family member to sing along to lullabies, nursery rhymes, and customized family songs.
                  </p>
                </div>

                <div className="flex flex-col gap-3 min-w-[200px] justify-center pt-2">
                  <TrainSingingButton voiceId={voice.id} initialStatus={voice.rvc_training_status} trainingId={voice.rvc_model_id} />
                </div>
              </div>
            </div>
          </div>
        </Tabs.Content>

        {/* VISUAL AVATAR TAB */}
        <Tabs.Content value="face" className="outline-none animate-in fade-in duration-300">
          {avatarUrl ? (
            /* Layout when Avatar Photo is Captured */
            <div className="rounded-[2rem] border border-[var(--ink-3)] bg-[var(--ink-1)] p-8 md:p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[var(--lamp)]/10 to-transparent blur-3xl rounded-full pointer-events-none" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <Sparkles className="h-5 w-5 text-[var(--lamp)]" />
                  <span className="rounded-full bg-[var(--lamp)]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--lamp-soft)] border border-[var(--lamp)]/30">
                    Pixar Model Synthesized
                  </span>
                </div>

                <h3 className="font-serif text-3xl text-white mb-6">Visual Clone Preview</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  {/* Left: Original Photo */}
                  <div className="space-y-3">
                    <span className="mono text-xs text-[var(--paper-mute)] tracking-wider block uppercase">Original Capture</span>
                    <div className="aspect-square w-full max-w-[280px] rounded-2xl overflow-hidden border border-[var(--ink-3)] bg-[var(--ink-2)]">
                      <img src={avatarUrl} alt="Original Capture" className="w-full h-full object-cover" />
                    </div>
                  </div>

                  {/* Right: Synthesized Pixar Headshot */}
                  <div className="space-y-3">
                    <span className="mono text-xs text-[var(--paper-mute)] tracking-wider block uppercase">Pixar Avatar Headshot</span>
                    <div className="aspect-square w-full max-w-[280px] rounded-2xl overflow-hidden border border-[var(--lamp)]/30 bg-[var(--ink-2)] relative group">
                      <img src="/mock_avatar.png" alt="Pixar Headshot" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="mono text-xs text-white border border-white/30 rounded-full px-3 py-1.5 bg-black/20">3D ASSET ACTIVE</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setIsCaptureOpen(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-[var(--ink-2)] text-[var(--paper)] border border-[var(--ink-3)] hover:bg-[var(--ink-3)] transition-all cursor-pointer"
                  >
                    <Camera className="h-4 w-4 text-[var(--lamp)]" />
                    Recapture Photo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Prompt to Capture Photo */
            <div className="rounded-[2rem] border border-[var(--ink-3)] bg-[var(--ink-1)] p-12 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--ink-2)] pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-full bg-[var(--ink-2)] border border-[var(--ink-3)] flex items-center justify-center mb-6 text-[var(--lamp)]">
                  <Camera className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-3xl text-white mb-4">
                  Add Visual Avatar
                </h3>
                <p className="text-[var(--paper-dim)] text-lg mb-8 leading-relaxed">
                  Capture a photo using your webcam to generate a custom 3D Disney Pixar character that matches your look.
                </p>
                <button
                  onClick={() => setIsCaptureOpen(true)}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold bg-[var(--lamp)] text-[var(--ink-0)] transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Camera className="h-5 w-5" />
                  Capture Webcam Photo
                </button>
              </div>
            </div>
          )}
        </Tabs.Content>

        {/* FULL BODY TAB */}
        <Tabs.Content value="body" className="outline-none animate-in fade-in duration-300">
          {avatarUrl ? (
            /* Display interactive PixarCloneCard */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Left: Pixar Clone Card */}
              <div className="w-full max-w-xs bg-[var(--ink-2)] rounded-3xl p-6 border border-[var(--ink-3)] text-white shadow-xl flex flex-col mx-auto">
                {/* 3D Viewport Box with Breathing/Talking CSS Animation */}
                <div className="w-full aspect-[4/5] bg-[var(--ink-1)] rounded-2xl overflow-hidden mb-5 relative border border-[var(--ink-3)] flex items-center justify-center">
                  <img
                    src="/mock_pixar_character.png"
                    alt="Pixar Character"
                    className="w-full h-full object-cover transition-all duration-300"
                    style={{
                      transformOrigin: "bottom center",
                      animation: isTalking
                        ? "characterTalk 0.5s ease-in-out infinite alternate"
                        : "characterBreathe 4s ease-in-out infinite",
                      filter: isTalking ? "drop-shadow(0 0 10px rgba(244,184,96,0.3))" : "none",
                    }}
                  />
                  
                  {/* Dynamic Gradient rim-light overlay on talk */}
                  {isTalking && (
                    <div 
                      className="absolute inset-0 pointer-events-none" 
                      style={{
                        boxShadow: "inset 0 0 30px rgba(244,184,96,0.25)",
                        background: "radial-gradient(circle, transparent 60%, rgba(244,184,96,0.1) 100%)"
                      }}
                    />
                  )}

                  {/* Active Waveform Overlay when talking */}
                  {isTalking && (
                    <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-sm rounded-xl p-3 border border-white/10 flex items-center justify-center gap-3">
                      <div className="flex items-center gap-1.5 h-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div
                            key={i}
                            className="w-1 bg-[var(--lamp)] rounded-full animate-[barWave_0.5s_ease-in-out_infinite_alternate]"
                            style={{
                              height: "100%",
                              animationDelay: `${i * 0.08}s`
                            }}
                          />
                        ))}
                      </div>
                      <span className="mono text-[10px] text-[var(--paper-dim)] tracking-wider">SPEAKING MODEL</span>
                    </div>
                  )}
                </div>

                {/* Meta Specs */}
                <div className="mb-5">
                  <h3 className="text-2xl font-serif text-white">{voice.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="mono text-[10px] text-[var(--paper-mute)] uppercase tracking-wider">Relative • Cloned</span>
                    <span className="w-1 h-1 rounded-full bg-[var(--moss)]"></span>
                    <span className="mono text-[10px] text-[var(--moss)] uppercase tracking-wider">Active</span>
                  </div>
                </div>

                {/* Trigger Button */}
                <button
                  onClick={togglePixarSample}
                  disabled={audioLoading}
                  className="w-full bg-[var(--lamp)] hover:opacity-90 active:scale-95 text-[var(--ink-0)] font-semibold py-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {audioLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : isTalking ? (
                    <>
                      <Square size={16} fill="currentColor" />
                      Stop Sample
                    </>
                  ) : (
                    <>
                      <Play size={16} fill="currentColor" />
                      Hear Sample
                    </>
                  )}
                </button>
              </div>

              {/* Right: Technical Integration details */}
              <div className="space-y-6">
                <h3 className="serif text-3xl text-white">Full-Body 3D Character Asset</h3>
                <p className="text-[var(--paper-dim)] text-lg leading-relaxed">
                  Now that your avatar photo is captured, our asset generation pipeline has created a full-body Pixar model matching your details.
                </p>

                <div className="space-y-4">
                  <div className="p-5 bg-[var(--ink-1)] border border-[var(--ink-3)] rounded-2xl flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-brand-sage/10 text-[var(--lamp)] flex items-center justify-center shrink-0 border border-brand-sage/20">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Disney Pixar Claymation Style</h4>
                      <p className="text-sm text-[var(--paper-dim)] mt-1">
                        Hardcoded rendering pipelines enforce a high-end 3D model that matches face shapes, clothing styles, and vibrant studio rim lighting.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 bg-[var(--ink-1)] border border-[var(--ink-3)] rounded-2xl flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-brand-sage/10 text-[var(--lamp)] flex items-center justify-center shrink-0 border border-brand-sage/20">
                      <Activity size={18} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Idle Breathing Animation</h4>
                      <p className="text-sm text-[var(--paper-dim)] mt-1">
                        Luma AI creates a 4-second breathing and blinking loop (`idle.webm`) to keep the character alive in resting states.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 bg-[var(--ink-1)] border border-[var(--ink-3)] rounded-2xl flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-brand-sage/10 text-[var(--lamp)] flex items-center justify-center shrink-0 border border-brand-sage/20">
                      <Mic size={18} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Hedra Audio-Driven Lip-Sync</h4>
                      <p className="text-sm text-[var(--paper-dim)] mt-1">
                        Lip-syncing engines combine the 3D model with your cloned voice file to create the talking bedtime narration clips.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Warning that Visual Avatar is Required */
            <div className="rounded-[2rem] border border-[var(--ink-3)] bg-[var(--ink-1)] p-12 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--ink-2)] pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-full bg-[var(--ink-2)] border border-[var(--ink-3)] flex items-center justify-center mb-6 text-[var(--paper-mute)]">
                  <Activity className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-3xl text-white mb-4">
                  Visual Avatar Required
                </h3>
                <p className="text-[var(--paper-dim)] text-lg mb-8 leading-relaxed">
                  Before you can view or test the full-body character model, you need to capture a photo of the family member under the Visual Avatar tab.
                </p>
                <button
                  onClick={() => setActiveTab("face")}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold bg-[var(--lamp)] text-[var(--ink-0)] transition-all cursor-pointer"
                >
                  Go to Visual Avatar Tab
                </button>
              </div>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>

      {/* Camera Capture Modal */}
      {isCaptureOpen && (
        <VisualCloneCapture
          voiceId={voice.id}
          onSuccess={handleCaptureSuccess}
          onClose={() => setIsCaptureOpen(false)}
        />
      )}

      {/* Breathing and talking CSS animations */}
      <style jsx global>{`
        @keyframes characterBreathe {
          0% { transform: scale(1.0); }
          50% { transform: scale(1.018) translateY(-1px); }
          100% { transform: scale(1.0); }
        }
        @keyframes characterTalk {
          0% { transform: scale(1.0) rotate(0deg); }
          25% { transform: scale(1.015) rotate(0.3deg) translateY(-2px); }
          75% { transform: scale(1.025) rotate(-0.3deg) translateY(-1px); }
          100% { transform: scale(1.0) rotate(0deg); }
        }
        @keyframes barWave {
          0% { height: 15%; }
          100% { height: 100%; }
        }
      `}</style>
    </>
  );
}
