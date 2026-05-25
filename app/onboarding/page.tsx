"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lightbulb, Loader2, CheckCircle2, Mic, StopCircle, ArrowRight, Upload, Sparkles, Video } from "lucide-react";
import { TwilightShell } from "@/components/twilight-layout";
import { OmniCaptureModal } from "@/components/omni-capture-modal";

type Step = 1 | 2 | 3;

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
]);

function pickContentType(file: File): string {
  if (file.type && ALLOWED_AUDIO_TYPES.has(file.type)) return file.type;
  return "audio/mpeg";
}

const TIPS = [
  "Did you know? Reading aloud to children helps develop their vocabulary and comprehension skills.",
  "Fun fact: A cloned voice can help comfort children by providing a familiar presence when parents are away.",
  "Did you know? Engage up to 3x longer with educational content narrated by a familiar family voice.",
  "Tip: You can soon cast different family clones as different characters in our upcoming multi-character stories!",
  "Fun fact: We use advanced AI models to capture the unique emotion and cadence of your loved ones.",
];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [voiceName, setVoiceName] = useState("");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  
  const [isOmniOpen, setIsOmniOpen] = useState(false);
  const [status, setStatus] = useState<string>("processing");
  const [error, setError] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  const router = useRouter();

  useEffect(() => {
    if (step === 3 && status === "processing") {
      const interval = setInterval(() => {
        setTipIndex((prev) => (prev + 1) % TIPS.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [step, status]);

  async function handleStep1() {
    if (!voiceName.trim()) return;
    setError(null);
    setUpgradePrompt(null);
    setSubmitting(true);

    try {
      // 1. Pre-create the voice clone ID in Step 1
      const createRes = await fetch("/api/voices/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: voiceName }),
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        if (createData.upgradeRequired && createData.upgradePrompt) {
          setUpgradePrompt(createData.upgradePrompt);
        } else {
          setError(createData.error ?? "Failed to create voice record.");
        }
        return;
      }

      setVoiceId(createData.voiceId);
      setStep(2);
    } catch {
      setError("Failed to create voice record. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const handleOmniComplete = (avatarUrl: string, audioUrl: string) => {
    if (voiceId) {
      localStorage.setItem(`sim_avatar_${voiceId}`, avatarUrl);
    }
    setIsOmniOpen(false);
    setStep(3);
    setStatus("ready");
    setTimeout(() => router.push("/dashboard/clones"), 2000);
  };

  return (
    <TwilightShell>
      <div style={{ maxWidth: 540, margin: "64px auto", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                height: 6, width: 48, borderRadius: 99,
                background: s <= step ? "var(--lamp)" : "var(--ink-2)",
                transition: "background 0.5s ease"
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="fadeUp" style={{ background: "var(--ink-1)", padding: 48, borderRadius: 24, border: "1px solid var(--ink-3)", textAlign: "center" }}>
            <h1 className="serif" style={{ fontSize: 32, margin: 0, color: "var(--paper)" }}>
              Who will be reading to your kids?
            </h1>
            <p style={{ color: "var(--paper-dim)", marginTop: 12, marginBottom: 32, fontSize: 15 }}>
              Enter the name of the family member you&apos;d like to clone.
            </p>

            <input
              type="text"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder='e.g. "Grandma Sue"'
              style={{
                width: "100%", padding: "16px 20px", fontSize: 18, borderRadius: 16,
                background: "var(--ink-2)", border: "1px solid var(--ink-3)",
                color: "var(--paper)", outline: "none", marginBottom: 24
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && voiceName.trim() && !submitting) {
                  handleStep1();
                }
              }}
            />

            {error && <p style={{ color: "var(--rose)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

            {upgradePrompt && (
              <div style={{ background: "rgba(244,184,96,0.1)", border: "1px solid rgba(244,184,96,0.3)", borderRadius: 16, padding: 20, textAlign: "left", marginBottom: 24 }}>
                <p style={{ fontWeight: 600, color: "var(--paper)", margin: 0 }}>Clone limit reached</p>
                <p style={{ fontSize: 14, color: "var(--paper-dim)", marginTop: 4 }}>{upgradePrompt}</p>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <Link href="/pricing" style={{ flex: 1, padding: 12, background: "var(--lamp)", color: "var(--ink-0)", textAlign: "center", borderRadius: 12, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>Upgrade Plan</Link>
                  <button onClick={() => setUpgradePrompt(null)} style={{ flex: 1, padding: 12, background: "transparent", color: "var(--paper)", border: "1px solid var(--ink-3)", borderRadius: 12, fontWeight: 500, fontSize: 14, cursor: "pointer" }}>Dismiss</button>
                </div>
              </div>
            )}

            {!upgradePrompt && (
              <button
                onClick={handleStep1}
                disabled={!voiceName.trim() || submitting}
                style={{
                  width: "100%", padding: 16, borderRadius: 16, border: 0,
                  background: "var(--lamp)", color: "var(--ink-0)", fontSize: 16, fontWeight: 600,
                  cursor: !voiceName.trim() || submitting ? "not-allowed" : "pointer",
                  opacity: !voiceName.trim() || submitting ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Continue
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="fadeUp" style={{ background: "var(--ink-1)", padding: 48, borderRadius: 24, border: "1px solid var(--ink-3)", textAlign: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ width: 64, height: 64, borderRadius: 99, background: "rgba(244,184,96,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                <Sparkles size={32} color="var(--lamp)" />
              </div>
              <div>
                <h1 className="serif" style={{ fontSize: 32, margin: 0, color: "var(--paper)" }}>Activate Your Clone</h1>
                <p style={{ color: "var(--paper-dim)", marginTop: 12, fontSize: 15, lineHeight: 1.5 }}>
                  Position your face in front of the camera and read the short sentence on screen. We will split the single capture into your voice profile and 3D character avatar.
                </p>
              </div>

              <button
                onClick={() => setIsOmniOpen(true)}
                style={{
                  width: "100%",
                  padding: 16,
                  borderRadius: 16,
                  border: 0,
                  background: "var(--lamp)",
                  color: "var(--ink-0)",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Video size={20} />
                Open Setup Interface
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="fadeUp" style={{ background: "var(--ink-1)", padding: 48, borderRadius: 24, border: "1px solid var(--ink-3)", textAlign: "center", position: "relative", overflow: "hidden" }}>
            {status === "processing" ? (
              <div style={{ width: 64, height: 64, borderRadius: 99, background: "rgba(244,184,96,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <Loader2 size={32} color="var(--lamp)" className="animate-spin" />
              </div>
            ) : status === "ready" ? (
              <div style={{ width: 64, height: 64, borderRadius: 99, background: "rgba(127,196,164,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <CheckCircle2 size={32} color="var(--paper)" />
              </div>
            ) : null}

            <div>
              <h1 className="serif" style={{ fontSize: 32, margin: 0, color: "var(--paper)" }}>
                {status === "ready" ? "Clone Complete!" : status === "failed" ? "Something went wrong" : `Cloning ${voiceName}...`}
              </h1>
              <p style={{ color: "var(--paper-dim)", marginTop: 12, fontSize: 15, lineHeight: 1.5 }}>
                {status === "ready" ? `Heading to your clones library...` : status === "failed" ? "Cloning failed. Please try again." : `Our AI is learning ${voiceName}'s unique tone, cadence, and features.`}
              </p>
            </div>

            {status === "processing" && (
              <div style={{ marginTop: 32 }}>
                <div style={{ height: 6, width: "100%", borderRadius: 99, background: "var(--ink-2)", overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "50%", background: "var(--lamp)", animation: "progress 2s ease-in-out infinite" }} />
                </div>
                
                <div style={{ marginTop: 32, padding: 24, borderRadius: 16, background: "var(--ink-2)", border: "1px solid var(--ink-3)", minHeight: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p key={tipIndex} style={{ margin: 0, fontSize: 14, color: "var(--paper)", lineHeight: 1.5, animation: "fadeUp 0.5s ease-out" }}>
                    {TIPS[tipIndex]}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isOmniOpen && voiceId && (
        <OmniCaptureModal
          voiceId={voiceId}
          voiceName={voiceName}
          onClose={() => setIsOmniOpen(false)}
          onCaptureComplete={handleOmniComplete}
        />
      )}
    </TwilightShell>
  );
}
