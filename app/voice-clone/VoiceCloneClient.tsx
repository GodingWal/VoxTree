"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Mic,
  MicOff,
  Upload,
  Play,
  Pause,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Volume2,
  Trash2,
  Sparkles,
  User,
  AlertCircle,
  CheckCircle2,
  Info,
  Headphones,
  Shield,
  Wand2,
  ArrowLeft,
} from "lucide-react";

/* ─────────────────── Types ─────────────────── */

type WizardStep = "intro" | "environment" | "record" | "review" | "create";

interface VoiceProfile {
  id: string;
  name: string;
  status: "processing" | "ready" | "failed";
  created_at: string;
  elevenlabs_voice_id?: string;
}

interface Props {
  userId: string;
  plan: string;
  voiceSlotsUsed: number;
  voiceSlotLimit: number | null;
  atLimit: boolean;
}

/* ─────────────────── Sample scripts ─────────────────── */

const SAMPLE_SCRIPTS = [
  {
    id: "greeting",
    title: "Natural Greeting",
    text: "Hello! My name is [say your name]. I'm excited to create my personal voice clone today. This technology is truly amazing, and I can't wait to hear how it turns out.",
    duration: "15–20 seconds",
  },
  {
    id: "story",
    title: "Short Story",
    text: "Once upon a time, in a land far away, there lived a curious little fox who loved to explore. Every morning, the fox would venture into the forest, discovering new paths and making friends along the way.",
    duration: "20–25 seconds",
  },
  {
    id: "variety",
    title: "Emotional Range",
    text: "I'm so happy to see you today! Wait, did you hear that noise? Oh, it's nothing to worry about. Anyway, let me tell you something important. Are you ready? Here it comes!",
    duration: "15–20 seconds",
  },
];

/* ─────────────────── Shared header ─────────────────── */

function Header() {
  return (
    <header className="border-b sticky top-0 z-40 bg-background/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold text-brand-green">
          VoxTree
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/browse" className="text-muted-foreground hover:text-foreground transition-colors">Browse</Link>
          <Link href="/stories" className="text-muted-foreground hover:text-foreground transition-colors">Stories</Link>
          <Link href="/profile" className="text-muted-foreground hover:text-foreground transition-colors">Profile</Link>
          <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">Settings</Link>
        </nav>
      </div>
    </header>
  );
}

/* ─────────────────── Main component ─────────────────── */

export default function VoiceCloneClient({
  userId,
  plan,
  voiceSlotsUsed,
  voiceSlotLimit,
  atLimit,
}: Props) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* wizard state */
  const [currentStep, setCurrentStep] = useState<WizardStep>("intro");
  const [voiceName, setVoiceName] = useState("");
  const [selectedScript, setSelectedScript] = useState(SAMPLE_SCRIPTS[0]);

  /* recording / audio state */
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [noiseLevel, setNoiseLevel] = useState<"low" | "medium" | "high">("low");
  const [environmentChecked, setEnvironmentChecked] = useState(false);

  /* submission state */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);

  /* selected profile for playback */
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  /* voice profiles list */
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ── Fetch voice profiles ── */
  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from("family_voices")
      .select("id, name, status, created_at, elevenlabs_voice_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) setVoiceProfiles(data as VoiceProfile[]);
    setProfilesLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProfiles();
    // Poll every 5 s if any profile is processing
    const interval = setInterval(() => {
      if (voiceProfiles.some((p) => p.status === "processing")) {
        fetchProfiles();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchProfiles, voiceProfiles.length]);

  /* ── Waveform drawing ── */
  const drawWaveform = useCallback(() => {
    if (!analyser || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = "rgba(15, 23, 42, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 3;
    ctx.strokeStyle = isRecording ? "#E8735A" : "#2D8B70";
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) sum += Math.abs(dataArray[i] - 128);
    const avgLevel = sum / bufferLength;
    setAudioLevel(Math.min(100, avgLevel * 2));
    setNoiseLevel(avgLevel < 5 ? "low" : avgLevel < 15 ? "medium" : "high");

    animationRef.current = requestAnimationFrame(drawWaveform);
  }, [analyser, isRecording]);

  useEffect(() => {
    if (analyser && (currentStep === "environment" || currentStep === "record")) {
      drawWaveform();
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, currentStep, drawWaveform]);

  /* ── Cleanup ── */
  const stopMicrophone = useCallback(() => {
    if (audioStream) audioStream.getTracks().forEach((t) => t.stop());
    if (audioContext) audioContext.close();
    setAudioStream(null);
    setAudioContext(null);
    setAnalyser(null);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }, [audioStream, audioContext]);

  useEffect(() => () => stopMicrophone(), [stopMicrophone]);

  /* ── Wizard helpers ── */
  const resetWizard = useCallback(() => {
    stopMicrophone();
    setCurrentStep("intro");
    setVoiceName("");
    setRecordedAudio(null);
    setUploadedFile(null);
    setRecordingTime(0);
    setIsPlaying(false);
    setEnvironmentChecked(false);
    setAudioLevel(0);
    setNoiseLevel("low");
    setSubmitError(null);
    setUpgradePrompt(null);
  }, [stopMicrophone]);

  /* ── Environment / mic check ── */
  const checkEnvironment = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 2048;
      source.connect(analyserNode);
      setAudioContext(ctx);
      setAnalyser(analyserNode);
      setAudioStream(stream);
      setEnvironmentChecked(true);
    } catch {
      alert("Microphone access is required. Please allow it in your browser and try again.");
    }
  };

  /* ── Recording ── */
  const startRecording = async () => {
    const stream = audioStream;
    if (!stream) {
      await checkEnvironment();
      return;
    }
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        setRecordedAudio(new Blob(chunks, { type: mimeType }));
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(
        () => setRecordingTime((t) => t + 1),
        1000
      );
    } catch {
      alert("Could not start recording. Please check your microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  /* ── File upload ── */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      alert("Please upload an audio file (MP3, WAV, M4A, etc.)");
      return;
    }
    setUploadedFile(file);
    setRecordedAudio(null);
    setCurrentStep("review");
  };

  /* ── Playback ── */
  const playRecordedAudio = () => {
    if (!audioRef.current) return;
    const src = recordedAudio || uploadedFile;
    if (!src) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.src = URL.createObjectURL(src);
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.onended = () => setIsPlaying(false);
  }, []);

  /* ── Create voice profile ── */
  const handleCreateProfile = async () => {
    const audioSource = recordedAudio || uploadedFile;
    if (!audioSource || !voiceName.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setUpgradePrompt(null);

    try {
      const contentType =
        audioSource instanceof File
          ? audioSource.type || "audio/mpeg"
          : "audio/webm";

      // 1. Create voice record + get presigned S3 URL
      const createRes = await fetch("/api/voices/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: voiceName.trim(), contentType }),
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        if (createData.upgradeRequired) {
          setUpgradePrompt(createData.upgradePrompt ?? "Please upgrade your plan.");
          setIsSubmitting(false);
          return;
        }
        throw new Error(createData.error ?? "Failed to create voice record");
      }

      const { voiceId, uploadUrl } = createData;

      // 2. Upload audio to S3
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: audioSource,
      });
      if (!uploadRes.ok) throw new Error("Audio upload failed");

      // 3. Process voice via ElevenLabs
      const processRes = await fetch("/api/voices/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId, userId, contentType }),
      });
      const processData = await processRes.json();
      if (!processRes.ok) throw new Error(processData.error ?? "Voice cloning failed");

      // Success — refresh list and reset wizard
      await fetchProfiles();
      resetWizard();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
      setIsSubmitting(false);
    }
  };

  /* ── Delete voice profile ── */
  const handleDelete = async (profileId: string, profileName: string) => {
    if (!confirm(`Delete voice "${profileName}"? This cannot be undone.`)) return;
    setDeletingId(profileId);
    try {
      const res = await fetch(`/api/voices/${profileId}`, { method: "DELETE" });
      if (res.ok) {
        setVoiceProfiles((prev) => prev.filter((p) => p.id !== profileId));
        if (selectedProfileId === profileId) setSelectedProfileId(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Preview voice ── */
  const playVoicePreview = async (profileId: string) => {
    // If we have a sample_audio_url we could play it; for now just show a toast
    if (isPlaying && selectedProfileId === profileId) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    setSelectedProfileId(profileId);
    // Playback would require a presigned URL — show a placeholder message
    alert("Voice preview will be available after the voice finishes processing.");
  };

  /* ── Helpers ── */
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const hasAudio = !!(recordedAudio || uploadedFile);
  const canProceed = voiceName.trim().length >= 2;

  const steps: { id: WizardStep; label: string }[] = [
    { id: "intro", label: "Start" },
    { id: "environment", label: "Setup" },
    { id: "record", label: "Record" },
    { id: "review", label: "Review" },
    { id: "create", label: "Create" },
  ];
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  /* ─────────────────── Render ─────────────────── */

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-brand-green/5 text-foreground">
      <audio ref={audioRef} preload="none" />
      <Header />

      <main className="pt-6 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Back link */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          {/* Page header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-green/10 text-brand-green text-sm font-medium mb-4">
              <Wand2 className="w-4 h-4" />
              AI Voice Cloning
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Create Your Voice Clone</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Record a high-quality voice sample and we'll create a digital copy that sounds just like you
            </p>
          </div>

          {/* At-limit banner */}
          {atLimit && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-amber-900">Voice profile limit reached</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  You've used {voiceSlotsUsed} of {voiceSlotLimit} voice profiles on your {plan} plan.
                </p>
              </div>
              <Link
                href="/pricing"
                className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                Upgrade
              </Link>
            </div>
          )}

          {/* Step progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between max-w-md mx-auto">
              {steps.map((step, index) => (
                <div key={step.id} className="flex flex-col items-center gap-1">
                  <div className="flex items-center">
                    <div
                      className={[
                        "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm",
                        index < currentStepIndex
                          ? "bg-brand-green text-white shadow-brand-green/30"
                          : index === currentStepIndex
                          ? "bg-brand-green text-white ring-4 ring-brand-green/25"
                          : "bg-muted/70 text-muted-foreground border-2 border-border",
                      ].join(" ")}
                    >
                      {index < currentStepIndex ? <Check className="w-4 h-4" /> : index + 1}
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={[
                          "w-8 sm:w-12 h-0.5 mx-1",
                          index < currentStepIndex ? "bg-brand-green" : "bg-border",
                        ].join(" ")}
                      />
                    )}
                  </div>
                  <span
                    className={[
                      "text-[10px] font-medium tracking-wide hidden sm:block",
                      index === currentStepIndex ? "text-brand-green" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Wizard card */}
          <div className="rounded-2xl border-0 shadow-xl bg-card/50 backdrop-blur p-6 sm:p-8">

            {/* ── Step: intro ── */}
            {currentStep === "intro" && (
              <div className="space-y-8">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-brand-green to-brand-sage flex items-center justify-center mb-6 shadow-lg shadow-brand-green/25">
                    <Mic className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Let's Get Started</h2>
                  <p className="text-muted-foreground">First, give your voice clone a memorable name</p>
                </div>

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      value={voiceName}
                      onChange={(e) => setVoiceName(e.target.value)}
                      placeholder="Enter voice name..."
                      className="w-full pl-10 pr-4 h-12 text-lg rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-brand-green/50 transition-shadow"
                      maxLength={50}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Examples: "Dad's Voice", "Grandma Mary", "My Voice"
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  {[
                    { icon: Shield, title: "Noise Removal", desc: "Background noise is automatically filtered" },
                    { icon: Sparkles, title: "AI Enhanced", desc: "Advanced processing for clear audio" },
                    { icon: Headphones, title: "High Quality", desc: "Studio-grade voice cloning" },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                      <Icon className="w-5 h-5 text-brand-green mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{title}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canProceed || atLimit}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-border bg-background text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Audio
                  </button>
                  <button
                    onClick={() => setCurrentStep("environment")}
                    disabled={!canProceed || atLimit}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-brand-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Record Voice
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: environment ── */}
            {currentStep === "environment" && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Environment Check</h2>
                  <p className="text-muted-foreground">Let's make sure your recording environment is optimal</p>
                </div>

                <div className="bg-muted/30 rounded-xl p-6 space-y-4">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={100}
                    className="w-full h-24 rounded-lg bg-slate-900"
                  />

                  {environmentChecked && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Audio Level</span>
                        <span className="text-sm font-medium">{Math.round(audioLevel)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-brand-green rounded-full transition-all duration-100"
                          style={{ width: `${audioLevel}%` }}
                        />
                      </div>
                      <div
                        className={[
                          "flex items-center gap-2 p-3 rounded-lg",
                          noiseLevel === "low"
                            ? "bg-green-500/10 text-green-600"
                            : noiseLevel === "medium"
                            ? "bg-yellow-500/10 text-yellow-600"
                            : "bg-red-500/10 text-red-600",
                        ].join(" ")}
                      >
                        {noiseLevel === "low" ? (
                          <>
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="text-sm font-medium">Excellent! Your environment is quiet</span>
                          </>
                        ) : noiseLevel === "medium" ? (
                          <>
                            <AlertCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">Some background noise detected</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">Too much noise — find a quieter spot</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { n: 1, title: "Find a quiet room", desc: "Close windows and doors" },
                    { n: 2, title: "Turn off fans & AC", desc: "Minimize humming sounds" },
                    { n: 3, title: "Position properly", desc: "6–8 inches from microphone" },
                    { n: 4, title: "Speak naturally", desc: "Normal pace and volume" },
                  ].map(({ n, title, desc }) => (
                    <div key={n} className="flex items-start gap-3 p-4 rounded-xl border bg-card">
                      <div className="w-8 h-8 rounded-full bg-brand-green/10 flex items-center justify-center shrink-0">
                        <span className="text-brand-green font-bold text-sm">{n}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{title}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setCurrentStep("intro")}
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border bg-background text-sm font-medium hover:bg-secondary transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                  {!environmentChecked ? (
                    <button
                      onClick={checkEnvironment}
                      className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-brand-green/90 transition-colors"
                    >
                      <Mic className="w-4 h-4" />
                      Check Microphone
                    </button>
                  ) : (
                    <button
                      onClick={() => setCurrentStep("record")}
                      disabled={noiseLevel === "high"}
                      className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-brand-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue to Recording
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Step: record ── */}
            {currentStep === "record" && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Record Your Voice</h2>
                  <p className="text-muted-foreground">Read the script below naturally for best results</p>
                </div>

                {/* Script selector */}
                <div className="flex gap-2 justify-center flex-wrap">
                  {SAMPLE_SCRIPTS.map((script) => (
                    <button
                      key={script.id}
                      onClick={() => setSelectedScript(script)}
                      disabled={isRecording}
                      className={[
                        "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
                        selectedScript.id === script.id
                          ? "bg-brand-green text-white border-brand-green"
                          : "bg-background border-border hover:border-brand-green/50 text-foreground",
                      ].join(" ")}
                    >
                      {script.title}
                    </button>
                  ))}
                </div>

                {/* Script to read */}
                <div className="bg-gradient-to-br from-brand-green/5 to-brand-sage/10 border border-brand-green/20 rounded-xl p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <Info className="w-5 h-5 text-brand-green mt-0.5 shrink-0" />
                    <p className="font-medium text-sm">Script to Read ({selectedScript.duration})</p>
                  </div>
                  <p className="text-lg leading-relaxed">"{selectedScript.text}"</p>
                </div>

                {/* Waveform + controls */}
                <div className="bg-muted/30 rounded-xl p-6 space-y-4">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={80}
                    className="w-full h-20 rounded-lg bg-slate-900"
                  />

                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <div className={["text-4xl font-mono font-bold", isRecording && "text-brand-coral"].join(" ")}>
                        {formatTime(recordingTime)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isRecording ? "Recording…" : recordedAudio ? "Recorded" : "Ready"}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={[
                        "w-20 h-20 rounded-full flex items-center justify-center transition-all",
                        isRecording
                          ? "bg-destructive hover:bg-destructive/90 animate-pulse"
                          : "bg-brand-green hover:bg-brand-green/90",
                      ].join(" ")}
                    >
                      {isRecording ? (
                        <div className="w-6 h-6 bg-white rounded-sm" />
                      ) : (
                        <Mic className="w-8 h-8 text-white" />
                      )}
                    </button>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    {isRecording ? "Click to stop recording" : "Click to start recording"}
                  </p>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setCurrentStep("environment")}
                    disabled={isRecording}
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border bg-background text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    onClick={() => setCurrentStep("review")}
                    disabled={!recordedAudio || isRecording}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-brand-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Review Recording
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: review ── */}
            {currentStep === "review" && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Review Your Recording</h2>
                  <p className="text-muted-foreground">Listen to make sure it sounds clear and natural</p>
                </div>

                <div className="rounded-xl bg-muted/30 border-0 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={playRecordedAudio}
                        className="w-14 h-14 rounded-full border-2 border-brand-green flex items-center justify-center hover:bg-brand-green/10 transition-colors"
                        aria-label={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? <Pause className="w-6 h-6 text-brand-green" /> : <Play className="w-6 h-6 text-brand-green ml-0.5" />}
                      </button>
                      <div>
                        <p className="font-medium">{voiceName}</p>
                        <p className="text-sm text-muted-foreground">
                          {uploadedFile ? uploadedFile.name : `${formatTime(recordingTime)} recording`}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                      Noise Filtered
                    </span>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
                  <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-blue-600">Quality Check</p>
                    <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                      <li>Is your voice clear and audible?</li>
                      <li>Did you read the full script?</li>
                      <li>Is there minimal background noise?</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setRecordedAudio(null);
                      setUploadedFile(null);
                      setCurrentStep(uploadedFile ? "intro" : "record");
                    }}
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border bg-background text-sm font-medium hover:bg-secondary transition-colors"
                  >
                    <MicOff className="w-4 h-4" />
                    Re-record
                  </button>
                  <button
                    onClick={() => setCurrentStep("create")}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-brand-green/90 transition-colors"
                  >
                    Sounds Good!
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: create ── */}
            {currentStep === "create" && (
              <div className="space-y-8 text-center">
                <div>
                  <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-brand-green via-brand-sage to-brand-gold flex items-center justify-center mb-6 shadow-lg shadow-brand-green/25 animate-pulse">
                    <Sparkles className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Ready to Create!</h2>
                  <p className="text-muted-foreground">
                    Your voice clone &quot;<span className="text-foreground font-medium">{voiceName}</span>&quot; will be ready in about 30 seconds
                  </p>
                </div>

                <div className="rounded-xl bg-muted/30 border-0 p-6 max-w-sm mx-auto space-y-4">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-12 h-12 rounded-full bg-brand-green/20 flex items-center justify-center shrink-0">
                      <Volume2 className="w-6 h-6 text-brand-green" />
                    </div>
                    <div>
                      <p className="font-medium">{voiceName}</p>
                      <p className="text-sm text-muted-foreground">
                        {uploadedFile ? uploadedFile.name : `${formatTime(recordingTime)} recording`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-4 pt-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="w-4 h-4 text-green-500" />
                      Noise Filtered
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Quality Verified
                    </div>
                  </div>
                </div>

                {submitError && (
                  <p className="text-sm text-destructive font-medium">{submitError}</p>
                )}

                {upgradePrompt && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-left space-y-3 max-w-sm mx-auto">
                    <p className="font-semibold text-amber-900">Voice profile limit reached</p>
                    <p className="text-sm text-amber-700">{upgradePrompt}</p>
                    <Link
                      href="/pricing"
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-amber-600 px-5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
                    >
                      View Plans
                    </Link>
                  </div>
                )}

                <div className="flex gap-4 max-w-sm mx-auto">
                  <button
                    onClick={() => setCurrentStep("review")}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border bg-background text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    onClick={handleCreateProfile}
                    disabled={isSubmitting || !!upgradePrompt}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-gradient-to-r from-brand-green to-brand-sage text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Create Voice Clone
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Voice profiles list ── */}
          {(voiceProfiles.length > 0 || profilesLoading) && (
            <div className="mt-12 space-y-4">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-brand-green" />
                <h2 className="text-xl font-semibold">Your Voice Clones</h2>
              </div>

              {profilesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {voiceProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className={[
                        "rounded-xl border bg-card p-4 transition-all hover:shadow-md",
                        selectedProfileId === profile.id ? "ring-2 ring-brand-green" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={[
                              "w-11 h-11 rounded-full flex items-center justify-center ring-2",
                              profile.status === "ready"
                                ? "bg-green-500/25 ring-green-500/50"
                                : profile.status === "failed"
                                ? "bg-red-500/25 ring-red-500/50"
                                : "bg-amber-500/25 ring-amber-500/50",
                            ].join(" ")}
                          >
                            {profile.status === "ready" ? (
                              <Volume2 className="w-5 h-5 text-green-500" />
                            ) : profile.status === "failed" ? (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            ) : (
                              <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{profile.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {profile.status === "ready" ? "Ready to use" : profile.status}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {profile.status === "ready" && (
                            <button
                              onClick={() => playVoicePreview(profile.id)}
                              className="w-9 h-9 rounded-lg border border-brand-green/40 flex items-center justify-center text-brand-green hover:bg-brand-green/10 transition-colors"
                              aria-label={`Play ${profile.name} preview`}
                            >
                              {isPlaying && selectedProfileId === profile.id ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(profile.id, profile.name)}
                            disabled={deletingId === profile.id}
                            className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5 transition-colors disabled:opacity-50"
                            aria-label={`Delete ${profile.name}`}
                          >
                            {deletingId === profile.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!profilesLoading && voiceProfiles.length === 0 && currentStep === "intro" && (
            <div className="mt-12 text-center py-10 rounded-xl border border-dashed border-border bg-muted/20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-green/10 flex items-center justify-center ring-2 ring-brand-green/20">
                <Volume2 className="w-8 h-8 text-brand-green" />
              </div>
              <p className="font-medium text-foreground">No voice clones yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first one above!</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
