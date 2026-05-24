"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lightbulb, Loader2, CheckCircle2, Mic, StopCircle, ArrowRight, Upload } from "lucide-react";
import { TwilightShell } from "@/components/twilight-layout";

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
  "Did you know? Children engage up to 3x longer with educational content narrated by a familiar family voice.",
  "Tip: You can soon cast different family clones as different characters in our upcoming multi-character stories!",
  "Fun fact: We use advanced AI models to capture the unique emotion and cadence of your loved ones.",
];

const SCRIPTS_TEMPLATES = {
  adventure: [
    {
      emotion: "Calm Narrator",
      text: "Once upon a time, in a quiet little forest where the leaves whispered secrets to the wind, there lived a small bunny named Barnaby. Every evening, as the stars began to twinkle like tiny lanterns in the sky, he would sit on his favorite mossy log and listen to the soft, comforting sounds of the woodland preparing to sleep.",
      color: "rgba(127,196,164,0.06)", textColor: "var(--lamp)",
      emoji: "📖",
    },
    {
      emotion: "Excited",
      text: "But today was no ordinary day! As Barnaby hopped near the whispering creek, he spotted something incredible hidden beneath a glowing patch of wildflowers. It was a giant, shimmering golden carrot that radiated warmth! 'Oh my goodness!' he squeaked, jumping high in the air, 'This must be the legendary carrot of the stars!'",
      color: "rgba(244,184,96,0.06)", textColor: "var(--lamp)",
      emoji: "✨",
    },
    {
      emotion: "Whispering",
      text: "Suddenly, Barnaby realized he wasn't alone. Just a few feet away, curled up under a massive oak tree, was Barnaby's friend, the giant sleeping bear. Barnaby held his breath and stepped as softly as he could, tip-toeing across the dry leaves so he wouldn't disturb the bear's deep, peaceful slumber.",
      color: "rgba(163,167,201,0.06)", textColor: "var(--lamp)",
      emoji: "🤫",
    },
    {
      emotion: "Surprised",
      text: "But just as he reached for the golden carrot—SNAP! A dry branch broke beneath his foot with a sound like a lightning crack! The wind stopped blowing, the forest went completely silent, and Barnaby's ears stood straight up. He spun around, his heart pounding in his chest, staring at the shifting shadow behind him!",
      color: "rgba(232,133,108,0.06)", textColor: "var(--rose)",
      emoji: "😲",
    },
    {
      emotion: "Grumpy",
      text: "'Who dares wake me from my lovely afternoon slumber?!' grumbled the bear, slowly rubbing his eyes and letting out a deep, rumbling sigh. 'I was having the most wonderful dream about a river made of honey, and now I am awake, cold, and terribly hungry! Speak up, little bunny!'",
      color: "rgba(197,143,184,0.06)", textColor: "var(--lamp)",
      emoji: "😠",
    },
  ],
  poetry: [
    {
      emotion: "Calm Narrator",
      text: "Look up at the velvety night sky, where the moon hangs like a silver crescent cradling the dark. The stars are scattered like diamond dust across the vastness of the darkness, guiding travelers home with their gentle, everlasting glow. It is a time for the world to rest.",
      color: "rgba(127,196,164,0.06)", textColor: "var(--lamp)",
      emoji: "🌌",
    },
    {
      emotion: "Excited",
      text: "Look how they dance and shimmer! Each star tells an ancient story of grand adventures, flying ships, and mysterious alien worlds far beyond our own. The whole sky is alive, sparkling with endless possibilities and secrets waiting to be discovered!",
      color: "rgba(244,184,96,0.06)", textColor: "var(--lamp)",
      emoji: "⭐",
    },
    {
      emotion: "Whispering",
      text: "Speak softly now, for the night is a quiet sanctuary for dreams. Let the gentle wind blow away all your loud thoughts as the houses dim their lights. Breathe in the cool air, and let the quietness wrap around you like a warm blanket.",
      color: "rgba(163,167,201,0.06)", textColor: "var(--lamp)",
      emoji: "💤",
    },
    {
      emotion: "Surprised",
      text: "Wait, look! A brilliant shooting star just streaked across the dark sky, leaving a glowing trail of gold behind it! It was so fast, like a flash of lightning in the dark! Did you see it? Make a wish quickly before the light disappears forever!",
      color: "rgba(232,133,108,0.06)", textColor: "var(--rose)",
      emoji: "☄️",
    },
    {
      emotion: "Grumpy",
      text: "Oh, it is gone already, and my wish didn't even have time to form! Why do shooting stars have to be so fast? I wanted to wish for a giant mountain of chocolate chip cookies, but now all I have is a dark sky and a cold breeze.",
      color: "rgba(197,143,184,0.06)", textColor: "var(--lamp)",
      emoji: "😒",
    },
  ],
  science: [
    {
      emotion: "Calm Narrator",
      text: "Our beautiful planet Earth is a blue and green sphere spinning gracefully in the freezing silence of space. It is home to deep oceans, tall snowy mountains, and millions of amazing plants and animals, all protected by a thin, delicate atmosphere that keeps us safe.",
      color: "rgba(127,196,164,0.06)", textColor: "var(--lamp)",
      emoji: "🌍",
    },
    {
      emotion: "Excited",
      text: "Did you know that the Earth travels around the Sun at over sixty-seven thousand miles per hour? That is incredibly fast! Yet, we feel perfectly still as we spin through the solar system on our grand journey around the giant, burning star!",
      color: "rgba(244,184,96,0.06)", textColor: "var(--lamp)",
      emoji: "🚀",
    },
    {
      emotion: "Whispering",
      text: "Far away on the dark side of the moon, there is no air, no wind, and absolutely no sound. Everything is completely silent, frozen in time under the quiet gaze of distant galaxies. It is the quietest place in our entire neighborhood.",
      color: "rgba(163,167,201,0.06)", textColor: "var(--lamp)",
      emoji: "🌙",
    },
    {
      emotion: "Surprised",
      text: "Look! A massive rocket engine suddenly fires with a blinding flash of light, roaring into the sky! It shakes the ground for miles around as it breaks free of Earth's heavy gravity, launching brave astronauts into the great unknown!",
      color: "rgba(232,133,108,0.06)", textColor: "var(--rose)",
      emoji: "💥",
    },
    {
      emotion: "Grumpy",
      text: "Space travel is so loud and takes forever! You have to sit in a tiny metal capsule for months, eating freeze-dried paste out of plastic bags. And don't get me started on how hard it is to wash your hair or sleep in zero gravity!",
      color: "rgba(197,143,184,0.06)", textColor: "var(--lamp)",
      emoji: "🛸",
    },
  ],
};

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [voiceName, setVoiceName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("processing");
  const [error, setError] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  
  // Teleprompter State
  const [useTeleprompter, setUseTeleprompter] = useState(true);
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "recording" | "finished">("idle");
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);

  // Teleprompter script state
  const [activeTemplate, setActiveTemplate] = useState<"adventure" | "poetry" | "science">("adventure");
  const [scriptCards, setScriptCards] = useState(SCRIPTS_TEMPLATES.adventure);
  const [isEditing, setIsEditing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (step === 3 && status === "processing") {
      const interval = setInterval(() => {
        setTipIndex((prev) => (prev + 1) % TIPS.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [step, status]);

  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mediaRecorder]);

  function handleStep1() {
    if (!voiceName.trim()) return;
    setError(null);
    setUpgradePrompt(null);
    setStep(2);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
        const newFile = new File([audioBlob], "teleprompter_recording.webm", { type: "audio/webm" });
        setFile(newFile);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecordingStatus("recording");
      setCurrentCardIndex(0);
    } catch (err) {
      console.error(err);
      setError("Could not access microphone. Please check your browser permissions or use the file upload option instead.");
      setUseTeleprompter(false);
    }
  }

  function nextCard() {
    if (currentCardIndex < scriptCards.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
    } else {
      stopRecording();
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setRecordingStatus("finished");
  }

  function resetRecording() {
    setFile(null);
    setRecordingStatus("idle");
    setCurrentCardIndex(0);
  }

  async function handleStep2() {
    if (!file) return;
    setError(null);
    setUpgradePrompt(null);
    setSubmitting(true);

    const contentType = pickContentType(file);

    try {
      const createRes = await fetch("/api/voices/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: voiceName, contentType }),
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        if (createData.upgradeRequired && createData.upgradePrompt) {
          setUpgradePrompt(createData.upgradePrompt);
          setStep(1);
        } else {
          setError(createData.error ?? "Failed to start upload.");
        }
        return;
      }

      const uploadRes = await fetch(createData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });

      if (!uploadRes.ok) {
        setError("Upload failed. Please try again.");
        return;
      }

      setStep(3);

      const processRes = await fetch("/api/voices/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: createData.voiceId }),
      });

      const processData = await processRes.json();
      setStatus(processData.status ?? "failed");

      if (processData.status === "ready") {
        setTimeout(() => router.push("/dashboard/clones"), 2000);
      }
    } catch {
      setError("Processing failed. Please try again.");
      setStatus("failed");
    } finally {
      setSubmitting(false);
    }
  }

  const currentCard = scriptCards[currentCardIndex];

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
              Enter the name of the family member whose voice you&apos;d like to clone.
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
                if (e.key === "Enter" && voiceName.trim()) {
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
                disabled={!voiceName.trim()}
                style={{
                  width: "100%", padding: 16, borderRadius: 16, border: 0,
                  background: "var(--lamp)", color: "var(--ink-0)", fontSize: 16, fontWeight: 600,
                  cursor: !voiceName.trim() ? "not-allowed" : "pointer",
                  opacity: !voiceName.trim() ? 0.5 : 1
                }}
              >
                Continue
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="fadeUp" style={{ background: "var(--ink-1)", padding: 48, borderRadius: 24, border: "1px solid var(--ink-3)", textAlign: "center" }}>
            {useTeleprompter ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {recordingStatus === "idle" && (
                  <>
                    <div style={{ width: 64, height: 64, borderRadius: 99, background: "rgba(244,184,96,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                      <Mic size={32} color="var(--lamp)" />
                    </div>
                    <div>
                      <h1 className="serif" style={{ fontSize: 32, margin: 0, color: "var(--paper)" }}>Capture {voiceName}&apos;s Voice</h1>
                      <p style={{ color: "var(--paper-dim)", marginTop: 12, fontSize: 15, lineHeight: 1.5 }}>
                        For a natural-sounding voice, ElevenLabs recommends reading a 1-2 minute sample. Choose a story template below, or customize the text to your liking.
                      </p>
                    </div>

                    {/* Script Selector */}
                    <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
                      <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--paper-mute)", textTransform: "uppercase" }}>Select Script Story</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        {(Object.keys(SCRIPTS_TEMPLATES) as Array<keyof typeof SCRIPTS_TEMPLATES>).map((t) => (
                          <button
                            key={t}
                            onClick={() => {
                              setActiveTemplate(t);
                              setScriptCards(SCRIPTS_TEMPLATES[t]);
                            }}
                            style={{
                              flex: 1,
                              padding: "10px 14px",
                              borderRadius: 12,
                              fontSize: 13,
                              fontWeight: 600,
                              background: activeTemplate === t ? "rgba(244,184,96,0.15)" : "var(--ink-2)",
                              border: `1px solid ${activeTemplate === t ? "var(--lamp)" : "var(--ink-3)"}`,
                              color: activeTemplate === t ? "var(--lamp-soft)" : "var(--paper-dim)",
                              cursor: "pointer",
                              transition: "all 0.2s"
                            }}
                          >
                            {t === "adventure" ? "🐰 Adventure" : t === "poetry" ? "🌌 Poetry" : "🚀 Science"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Estimated stats */}
                    <div style={{ background: "var(--ink-2)", border: "1px solid var(--ink-3)", borderRadius: 16, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "var(--paper-dim)", textAlign: "left" }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--paper)" }}>Word Count</div>
                        <div className="mono" style={{ fontSize: 11, marginTop: 4, color: "var(--lamp)" }}>{scriptCards.reduce((acc, c) => acc + c.text.split(" ").length, 0)} words</div>
                      </div>
                      <div style={{ width: 1, height: 28, background: "var(--ink-3)" }} />
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--paper)" }}>Estimated Read</div>
                        <div className="mono" style={{ fontSize: 11, marginTop: 4, color: "var(--moss)" }}>~90 - 120 seconds</div>
                      </div>
                    </div>

                    {/* Script Preview & Customize */}
                    <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--paper-mute)", textTransform: "uppercase" }}>Customize Script text</span>
                        <button
                          onClick={() => setIsEditing(!isEditing)}
                          style={{
                            background: "none",
                            border: 0,
                            color: "var(--lamp)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: 4
                          }}
                        >
                          {isEditing ? "Done Customizing" : "Edit lines..."}
                        </button>
                      </div>

                      {isEditing ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                          {scriptCards.map((c, i) => (
                            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--ink-2)", border: "1px solid var(--ink-3)", borderRadius: 12, padding: 12 }}>
                              <span className="mono" style={{ fontSize: 10, color: "var(--paper-mute)" }}>LINE {i+1} ({c.emotion})</span>
                              <textarea
                                value={c.text}
                                onChange={(e) => {
                                  const updated = [...scriptCards];
                                  updated[i] = { ...updated[i], text: e.target.value };
                                  setScriptCards(updated);
                                }}
                                rows={2}
                                style={{
                                  background: "var(--ink-1)",
                                  border: "1px solid var(--ink-3)",
                                  borderRadius: 8,
                                  padding: 8,
                                  color: "var(--paper)",
                                  fontSize: 13,
                                  outline: "none",
                                  resize: "vertical"
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ maxHeight: 120, overflowY: "auto", padding: "12px 16px", background: "var(--ink-2)", border: "1px solid var(--ink-3)", borderRadius: 16, fontSize: 13, color: "var(--paper-dim)", lineHeight: 1.5 }}>
                          {scriptCards.map((c, i) => (
                            <p key={i} style={{ margin: "0 0 10px 0" }}>
                              <strong style={{ color: "var(--lamp)" }}>{c.emotion}:</strong> {c.text}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    <button onClick={startRecording} style={{ width: "100%", padding: 16, borderRadius: 16, border: 0, background: "var(--lamp)", color: "var(--ink-0)", fontSize: 16, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <Mic size={20} /> Start Teleprompter
                    </button>
                  </>
                )}

                {recordingStatus === "recording" && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px" }}>
                      <div className="mono" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--rose)", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em" }}>
                        <div style={{ width: 10, height: 10, borderRadius: 99, background: "var(--rose)", animation: "lampPulse 1.5s infinite" }} />
                        RECORDING
                      </div>
                      <div className="mono" style={{ fontSize: 12, color: "var(--paper-mute)", letterSpacing: "0.1em" }}>
                        Card {currentCardIndex + 1} of {scriptCards.length}
                      </div>
                    </div>

                    <div style={{ height: 6, borderRadius: 99, background: "var(--ink-2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", background: "var(--lamp)", width: `${((currentCardIndex) / scriptCards.length) * 100}%`, transition: "width 0.5s ease" }} />
                    </div>

                    <div style={{ padding: 32, borderRadius: 20, background: currentCard.color, textAlign: "left", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <span style={{ fontSize: 24 }}>{currentCard.emoji}</span>
                        <span className="mono" style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: currentCard.textColor, fontWeight: 600 }}>Read as: {currentCard.emotion}</span>
                      </div>
                      <p className="serif" style={{ fontSize: 28, margin: 0, lineHeight: 1.4, color: "var(--paper)" }}>
                        &quot;{currentCard.text}&quot;
                      </p>
                    </div>

                    <button onClick={nextCard} style={{ width: "100%", padding: 16, borderRadius: 16, border: 0, background: "var(--lamp)", color: "var(--ink-0)", fontSize: 16, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      {currentCardIndex < scriptCards.length - 1 ? (
                        <>Next Line <ArrowRight size={20} /></>
                      ) : (
                        <>Finish Recording <StopCircle size={20} /></>
                      )}
                    </button>
                  </>
                )}

                {recordingStatus === "finished" && (
                  <>
                    <div style={{ width: 64, height: 64, borderRadius: 99, background: "rgba(127,196,164,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                      <CheckCircle2 size={32} color="var(--paper)" />
                    </div>
                    <div>
                      <h1 className="serif" style={{ fontSize: 32, margin: 0, color: "var(--paper)" }}>Beautifully done!</h1>
                      <p style={{ color: "var(--paper-dim)", marginTop: 12, fontSize: 15, lineHeight: 1.5 }}>
                        We captured incredible dynamic range for {voiceName}. Ready to create the clone?
                      </p>
                    </div>

                    {error && <p style={{ color: "var(--rose)", fontSize: 13 }}>{error}</p>}

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <button onClick={handleStep2} disabled={submitting} style={{ width: "100%", padding: 16, borderRadius: 16, border: 0, background: "var(--lamp)", color: "var(--ink-0)", fontSize: 16, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        {submitting && <Loader2 size={20} className="animate-spin" />}
                        {submitting ? "Uploading Voice..." : "Create Voice Clone"}
                      </button>
                      <button onClick={resetRecording} disabled={submitting} style={{ width: "100%", padding: 16, borderRadius: 16, border: "1px solid var(--ink-3)", background: "transparent", color: "var(--paper)", fontSize: 16, fontWeight: 500, cursor: submitting ? "not-allowed" : "pointer" }}>
                        Retake Recording
                      </button>
                    </div>
                  </>
                )}

                {recordingStatus === "idle" && (
                  <button onClick={() => { setUseTeleprompter(false); setError(null); }} style={{ background: "none", border: 0, color: "var(--paper-mute)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 }}>
                    <Upload size={16} /> Prefer to upload an existing file?
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <h1 className="serif" style={{ fontSize: 32, margin: 0, color: "var(--paper)" }}>Upload a voice sample</h1>
                  <p style={{ color: "var(--paper-dim)", marginTop: 12, fontSize: 15, lineHeight: 1.5 }}>
                    Upload a 30-60 second audio recording of {voiceName} speaking naturally. 
                  </p>
                </div>

                <div onClick={() => fileInputRef.current?.click()} style={{ border: "2px dashed var(--ink-3)", borderRadius: 20, padding: 40, cursor: "pointer", background: "var(--ink-2)", transition: "border-color 0.2s" }}>
                  <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  {file ? (
                    <div>
                      <div style={{ width: 48, height: 48, borderRadius: 99, background: "rgba(127,196,164,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                        <CheckCircle2 size={24} color="var(--paper)" />
                      </div>
                      <p style={{ fontWeight: 500, color: "var(--paper)", margin: 0 }}>{file.name}</p>
                      <p style={{ fontSize: 13, color: "var(--paper-mute)", marginTop: 4 }}>{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ width: 48, height: 48, borderRadius: 99, background: "rgba(244,184,96,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                        <Lightbulb size={24} color="var(--lamp)" />
                      </div>
                      <p style={{ fontWeight: 600, color: "var(--paper)", margin: 0 }}>Click to upload audio</p>
                      <p style={{ fontSize: 13, color: "var(--paper-mute)", marginTop: 4 }}>MP3, WAV, or M4A — max 10MB</p>
                    </div>
                  )}
                </div>

                {error && <p style={{ color: "var(--rose)", fontSize: 13 }}>{error}</p>}

                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => setStep(1)} style={{ padding: 16, borderRadius: 16, border: "1px solid var(--ink-3)", background: "transparent", color: "var(--paper)", fontSize: 16, fontWeight: 500, cursor: "pointer", width: 100 }}>Back</button>
                  <button onClick={handleStep2} disabled={!file || submitting} style={{ flex: 1, padding: 16, borderRadius: 16, border: 0, background: "var(--lamp)", color: "var(--ink-0)", fontSize: 16, fontWeight: 600, cursor: !file || submitting ? "not-allowed" : "pointer", opacity: !file || submitting ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {submitting && <Loader2 size={20} className="animate-spin" />}
                    {submitting ? "Uploading…" : "Upload & Process"}
                  </button>
                </div>

                <button onClick={() => { setUseTeleprompter(true); setFile(null); setError(null); }} style={{ background: "none", border: 0, color: "var(--paper-mute)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
                  <Mic size={16} /> Try the interactive Teleprompter instead
                </button>
              </div>
            )}
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
                {status === "ready" ? `Heading to your clones library...` : status === "failed" ? "Voice cloning failed. Please try again with a different audio sample." : `Our AI is learning ${voiceName}'s unique tone and cadence.`}
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

            {status === "failed" && (
              <button onClick={() => { setStep(2); resetRecording(); }} style={{ marginTop: 24, padding: "12px 32px", borderRadius: 12, border: "1px solid var(--ink-3)", background: "transparent", color: "var(--paper)", fontSize: 15, fontWeight: 500, cursor: "pointer" }}>
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </TwilightShell>
  );
}
