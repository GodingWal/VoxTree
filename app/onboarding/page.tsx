"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lightbulb, Loader2, CheckCircle2, Mic, StopCircle, ArrowRight, Upload } from "lucide-react";

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

const SCRIPT_CARDS = [
  {
    emotion: "Calm Narrator",
    text: "Once upon a time, in a quiet little forest...",
    color: "bg-brand-sage/20 text-brand-green",
    emoji: "📖",
  },
  {
    emotion: "Excited",
    text: "...a tiny bunny discovered a giant, shiny, magical carrot!",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    emoji: "✨",
  },
  {
    emotion: "Whispering",
    text: "He had to be very, very quiet, so the sleeping bear wouldn't wake up.",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    emoji: "🤫",
  },
  {
    emotion: "Surprised",
    text: "But then—SNAP! A loud branch broke right behind him!",
    color: "bg-brand-coral/20 text-brand-coral",
    emoji: "😲",
  },
  {
    emotion: "Grumpy",
    text: "'Who wakes me from my slumber?!' grumbled the bear.",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    emoji: "😠",
  },
];

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Rotate tips when processing
  useEffect(() => {
    if (step === 3 && status === "processing") {
      const interval = setInterval(() => {
        setTipIndex((prev) => (prev + 1) % TIPS.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [step, status]);

  // Cleanup media recorder on unmount
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
        
        // Stop all tracks to turn off microphone indicator
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
    if (currentCardIndex < SCRIPT_CARDS.length - 1) {
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

  const currentCard = SCRIPT_CARDS[currentCardIndex];

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-brand-cream/30 dark:bg-background py-12">
      <div className="w-full max-w-lg space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2.5 w-16 rounded-full transition-colors duration-500 ${
                s <= step ? "bg-brand-green" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Name */}
        {step === 1 && (
          <div className="space-y-6 text-center bg-white dark:bg-card p-8 sm:p-10 rounded-3xl shadow-xl border">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-brand-charcoal dark:text-foreground">
                Who will be reading to your kids?
              </h1>
              <p className="text-muted-foreground">
                Enter the name of the family member whose voice you&apos;d like
                to clone.
              </p>
            </div>

            <input
              type="text"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder='e.g. "Grandma Sue"'
              className="flex h-14 w-full rounded-xl border border-input bg-background px-4 py-2 text-lg ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              onKeyDown={(e) => {
                if (e.key === "Enter" && voiceName.trim()) {
                  handleStep1();
                }
              }}
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Voice limit upsell modal */}
            {upgradePrompt && (
              <div className="rounded-xl border border-brand-gold/30 bg-gradient-to-r from-brand-gold/10 via-brand-gold/5 to-transparent p-5 space-y-4 text-left">
                <div className="space-y-1">
                  <p className="font-semibold text-brand-charcoal dark:text-foreground">
                    Clone limit reached
                  </p>
                  <p className="text-sm text-muted-foreground">{upgradePrompt}</p>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/pricing"
                    className="flex-1 inline-flex h-10 items-center justify-center rounded-lg bg-brand-gold px-4 text-sm font-medium text-white hover:bg-brand-gold/90 transition-colors"
                  >
                    Upgrade Plan
                  </Link>
                  <button
                    onClick={() => setUpgradePrompt(null)}
                    className="flex-1 inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-accent transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {!upgradePrompt && (
              <button
                onClick={handleStep1}
                disabled={!voiceName.trim()}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-green px-4 py-2 text-base font-semibold text-white hover:bg-brand-green/90 transition-all disabled:pointer-events-none disabled:opacity-50 hover:shadow-lg hover:-translate-y-0.5"
              >
                Continue
              </button>
            )}
          </div>
        )}

        {/* Step 2: Upload or Teleprompter */}
        {step === 2 && (
          <div className="space-y-6 text-center bg-white dark:bg-card p-8 sm:p-10 rounded-3xl shadow-xl border relative overflow-hidden transition-all duration-500">
            {useTeleprompter ? (
              // --- TELEPROMPTER UI ---
              <div className="space-y-8">
                {recordingStatus === "idle" && (
                  <div className="space-y-6 animate-in fade-in zoom-in-95">
                    <div className="mx-auto w-16 h-16 rounded-full bg-brand-sage/20 flex items-center justify-center">
                      <Mic className="h-8 w-8 text-brand-green" />
                    </div>
                    <div className="space-y-2">
                      <h1 className="text-2xl font-bold text-brand-charcoal dark:text-foreground">
                        Capture {voiceName}&apos;s Emotion
                      </h1>
                      <p className="text-muted-foreground">
                        To build the perfect storyteller voice, we need to capture your emotional range. We&apos;ll guide you through a short 5-part script.
                      </p>
                    </div>
                    <button
                      onClick={startRecording}
                      className="w-full inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-brand-coral px-4 py-2 text-base font-semibold text-white hover:bg-brand-coral/90 transition-all shadow-lg shadow-brand-coral/20 hover:-translate-y-0.5"
                    >
                      <Mic className="h-5 w-5" />
                      Start Teleprompter
                    </button>
                  </div>
                )}

                {recordingStatus === "recording" && (
                  <div className="space-y-6">
                    {/* Live Indicator */}
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-2 text-brand-coral font-semibold">
                        <div className="w-2.5 h-2.5 rounded-full bg-brand-coral animate-pulse" />
                        RECORDING
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Card {currentCardIndex + 1} of {SCRIPT_CARDS.length}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-brand-green transition-all duration-500" 
                        style={{ width: `${((currentCardIndex) / SCRIPT_CARDS.length) * 100}%` }}
                      />
                    </div>

                    {/* Emotion Card */}
                    <div key={currentCardIndex} className="animate-in slide-in-from-right-8 fade-in duration-300">
                      <div className={`p-8 rounded-2xl border text-left shadow-inner ${currentCard.color} bg-opacity-10 transition-colors duration-500`}>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-2xl">{currentCard.emoji}</span>
                          <span className="font-bold uppercase tracking-wider text-sm opacity-90">Read as: {currentCard.emotion}</span>
                        </div>
                        <p className="text-2xl font-medium leading-relaxed">
                          &quot;{currentCard.text}&quot;
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={nextCard}
                      className="w-full inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-2 text-base font-semibold text-white hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20"
                    >
                      {currentCardIndex < SCRIPT_CARDS.length - 1 ? (
                        <>Next Line <ArrowRight className="h-5 w-5" /></>
                      ) : (
                        <>Finish Recording <StopCircle className="h-5 w-5" /></>
                      )}
                    </button>
                  </div>
                )}

                {recordingStatus === "finished" && (
                  <div className="space-y-6 animate-in fade-in zoom-in-95">
                    <div className="mx-auto w-16 h-16 rounded-full bg-brand-green/20 flex items-center justify-center text-brand-green">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                      <h1 className="text-2xl font-bold text-brand-charcoal dark:text-foreground">
                        Beautifully done!
                      </h1>
                      <p className="text-muted-foreground">
                        We captured incredible dynamic range for {voiceName}. Ready to create the clone?
                      </p>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <div className="space-y-3">
                      <button
                        onClick={handleStep2}
                        disabled={submitting}
                        className="w-full inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-2 text-base font-semibold text-white hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20 disabled:opacity-50"
                      >
                        {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
                        {submitting ? "Uploading Voice..." : "Create Voice Clone"}
                      </button>
                      <button
                        onClick={resetRecording}
                        disabled={submitting}
                        className="w-full inline-flex h-12 items-center justify-center rounded-xl border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        Retake Recording
                      </button>
                    </div>
                  </div>
                )}

                {/* Toggle to Standard Upload */}
                {recordingStatus === "idle" && (
                  <button 
                    onClick={() => {
                      setUseTeleprompter(false);
                      setError(null);
                    }}
                    className="text-sm text-muted-foreground hover:text-brand-green transition-colors mt-4 inline-flex items-center gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" /> Prefer to upload an existing file?
                  </button>
                )}
              </div>
            ) : (
              // --- STANDARD FILE UPLOAD UI ---
              <div className="space-y-6 animate-in fade-in zoom-in-95">
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-brand-charcoal dark:text-foreground">
                    Upload a voice sample
                  </h1>
                  <p className="text-muted-foreground">
                    Upload a 30-60 second audio recording of {voiceName} speaking
                    naturally. 
                  </p>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer rounded-2xl border-2 border-dashed border-brand-sage p-8 transition-colors hover:border-brand-green bg-brand-sage/5 hover:bg-brand-sage/10 group relative overflow-hidden"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {file ? (
                    <div className="space-y-1 relative z-10">
                      <div className="w-12 h-12 rounded-full bg-brand-green/20 text-brand-green flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <p className="font-medium text-brand-charcoal dark:text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 relative z-10">
                      <div className="w-12 h-12 rounded-full bg-white dark:bg-card shadow-sm flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Lightbulb className="h-5 w-5 text-brand-green" />
                      </div>
                      <p className="font-semibold text-brand-charcoal dark:text-foreground">Click to upload audio</p>
                      <p className="text-sm text-muted-foreground">
                        MP3, WAV, or M4A — max 10MB
                      </p>
                    </div>
                  )}
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="inline-flex h-12 items-center justify-center rounded-xl border bg-background px-6 py-2 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleStep2}
                    disabled={!file || submitting}
                    className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-2 text-base font-semibold text-white hover:bg-brand-green/90 transition-all disabled:pointer-events-none disabled:opacity-50 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? "Uploading…" : "Upload & Process"}
                  </button>
                </div>

                <button 
                  onClick={() => {
                    setUseTeleprompter(true);
                    setFile(null);
                    setError(null);
                  }}
                  className="text-sm text-muted-foreground hover:text-brand-green transition-colors mt-2 inline-flex items-center gap-1.5"
                >
                  <Mic className="h-3.5 w-3.5" /> Try the interactive Teleprompter instead
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 3 && (
          <div className="space-y-8 text-center bg-white dark:bg-card p-8 sm:p-10 rounded-3xl shadow-xl border overflow-hidden relative">
            {status === "processing" && (
              <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/10 via-white to-brand-green/10 dark:from-brand-gold/5 dark:via-background dark:to-brand-green/5 animate-pulse" style={{ animationDuration: '3s' }} />
            )}
            
            <div className="relative z-10 space-y-4">
              {status === "processing" ? (
                <div className="mx-auto w-16 h-16 rounded-full bg-brand-gold/20 flex items-center justify-center mb-6">
                  <Loader2 className="h-8 w-8 text-brand-gold animate-spin" />
                </div>
              ) : status === "ready" ? (
                <div className="mx-auto w-16 h-16 rounded-full bg-brand-green/20 flex items-center justify-center mb-6 animate-in zoom-in-50">
                  <CheckCircle2 className="h-8 w-8 text-brand-green" />
                </div>
              ) : null}

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-brand-charcoal dark:text-foreground">
                  {status === "ready"
                    ? "Clone Complete!"
                    : status === "failed"
                      ? "Something went wrong"
                      : `Cloning ${voiceName}...`}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {status === "ready"
                    ? `Heading to your clones library...`
                    : status === "failed"
                      ? "Voice cloning failed. Please try again with a different audio sample."
                      : `Our AI is learning ${voiceName}'s unique tone and cadence.`}
                </p>
              </div>

              {status === "processing" && (
                <div className="pt-8">
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 bg-brand-gold w-full origin-left animate-[progress_2s_ease-in-out_infinite]" />
                  </div>
                  
                  {/* Rotating Gamified Tips */}
                  <div className="mt-8 p-4 rounded-xl bg-brand-sage/10 border border-brand-sage/20 min-h-[100px] flex items-center justify-center">
                    <p 
                      key={tipIndex} 
                      className="text-sm font-medium text-brand-charcoal dark:text-foreground animate-in fade-in zoom-in-95 duration-500 text-center"
                    >
                      {TIPS[tipIndex]}
                    </p>
                  </div>
                </div>
              )}

              {status === "failed" && (
                <button
                  onClick={() => {
                    setStep(2);
                    resetRecording();
                  }}
                  className="mt-6 inline-flex h-12 items-center justify-center rounded-xl border border-input bg-background px-8 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
