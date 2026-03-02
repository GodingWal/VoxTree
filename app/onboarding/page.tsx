"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ─── 8 Recording Phases ─── */
const RECORDING_PROMPTS = [
  {
    id: "intro",
    title: "Phase 1: Introduction",
    text: 'Hello there! My name is [Your Name], and today I am recording my voice for a very special project. I hope this recording captures my natural speaking voice perfectly. Thank you for listening to me today.',
    description: "Speak naturally and clearly. This captures your baseline voice.",
    minDuration: 12,
    maxDuration: 20,
  },
  {
    id: "alphabet",
    title: "Phase 2: Letters & Numbers",
    text: "A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z. Now counting: one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, twenty.",
    description: "Say each letter and number clearly with brief pauses between them.",
    minDuration: 15,
    maxDuration: 25,
  },
  {
    id: "phonetics",
    title: "Phase 3: Phonetic Phrases",
    text: "The thick thistle thickets threatened the three thriving thrushes. She sells seashells by the seashore. Peter Piper picked a peck of pickled peppers. How much wood would a woodchuck chuck if a woodchuck could chuck wood?",
    description: "Practice these tongue twisters slowly and clearly to capture all speech sounds.",
    minDuration: 15,
    maxDuration: 25,
  },
  {
    id: "story",
    title: "Phase 4: Storytelling",
    text: "Once upon a time, in a faraway land, there lived a kind old wizard who loved to tell stories by the fireplace. Every evening, children from the village would gather around to hear tales of brave knights, magical creatures, and hidden treasures buried deep within enchanted forests.",
    description: "Tell this story with emotion and varied intonation like you are reading to a child.",
    minDuration: 18,
    maxDuration: 28,
  },
  {
    id: "questions",
    title: "Phase 5: Questions & Responses",
    text: "What time is it? It is half past three. Where are you going? I am going to the store. How was your day today? My day was absolutely wonderful, thank you for asking! Did you remember to bring the keys? Yes, I have them right here in my pocket.",
    description: "Use natural question intonation, then answer with declarative statements.",
    minDuration: 15,
    maxDuration: 25,
  },
  {
    id: "emotions",
    title: "Phase 6: Emotional Range",
    text: "I am so incredibly happy right now! This is the best day ever! Oh no, that is really sad news, I am so sorry to hear that. Wait, what? Are you serious? I cannot believe this is happening! Well, that is interesting, I suppose I will have to think about it more carefully.",
    description: "Express joy, sadness, surprise, and thoughtfulness in your voice.",
    minDuration: 15,
    maxDuration: 25,
  },
  {
    id: "directions",
    title: "Phase 7: Instructions & Commands",
    text: "Please open the door and walk inside. Turn left at the first hallway, then continue straight ahead. You will find the kitchen on your right. Remember to close the window before you leave, and do not forget to lock the front door behind you.",
    description: "Speak clearly and authoritatively, as if giving directions to someone.",
    minDuration: 15,
    maxDuration: 25,
  },
  {
    id: "conversation",
    title: "Phase 8: Natural Conversation",
    text: "You know, I was thinking about what you said earlier, and I think you might be right about that. It is funny how things work out sometimes, is it not? Anyway, let me know what you decide, and we can figure out the rest together. I really appreciate you taking the time to help me with this.",
    description: "Speak casually and naturally, as if talking to a close friend.",
    minDuration: 15,
    maxDuration: 25,
  },
];

interface RecordingSession {
  id: string;
  blob: Blob | null;
  duration: number;
  quality: { score: number; issues: string[]; recommendations: string[] };
  status: "pending" | "recording" | "paused" | "processing" | "completed" | "failed";
}

type WizardStep = "name" | "environment" | "recording" | "review" | "processing";

export default function OnboardingPage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auth & plan
  const [plan, setPlan] = useState("free");
  const [authLoading, setAuthLoading] = useState(true);

  // Wizard top-level step
  const [wizardStep, setWizardStep] = useState<WizardStep>("name");
  const [voiceName, setVoiceName] = useState("");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"s3" | "direct">("direct");
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);

  // 8-phase recording state
  const [currentPhase, setCurrentPhase] = useState(0);
  const [recordings, setRecordings] = useState<RecordingSession[]>(
    RECORDING_PROMPTS.map((p) => ({
      id: p.id,
      blob: null,
      duration: 0,
      quality: { score: 0, issues: [], recommendations: [] },
      status: "pending" as const,
    }))
  );

  // Mic / recording
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [noiseLevel, setNoiseLevel] = useState<"low" | "medium" | "high">("low");
  const [qualityWarnings, setQualityWarnings] = useState<string[]>([]);
  const [environmentChecked, setEnvironmentChecked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Media refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioLevelAnimationRef = useRef<number | null>(null);

  // Upload file
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Processing state
  const [status, setStatus] = useState<"processing" | "ready" | "failed">("processing");
  const [error, setError] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const wizardSteps = [
    { id: "name", label: "Name" },
    { id: "environment", label: "Setup" },
    { id: "recording", label: "Record (8 Phases)" },
    { id: "review", label: "Review" },
    { id: "processing", label: "Create" },
  ];
  const currentStepIndex = wizardSteps.findIndex((s) => s.id === wizardStep);

  /* ── Auth check ── */
  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase.from("users").select("plan").eq("id", user.id).single();
      if (data?.plan) setPlan(data.plan);
      setAuthLoading(false);
    }
    check();
  }, []);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (wizardStep !== "recording") return;

      if (e.code === "Space" && !isPlaying) {
        e.preventDefault();
        if (isRecording && !isPaused) pauseRecording();
        else if (isPaused) resumeRecording();
        else if (hasPermission) startRecording();
      } else if (e.code === "Escape") {
        e.preventDefault();
        if (isRecording || isPaused) stopRecording();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isRecording, isPaused, isPlaying, hasPermission, wizardStep]);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioLevelAnimationRef.current) cancelAnimationFrame(audioLevelAnimationRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current && audioContextRef.current.state !== "closed") audioContextRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.onended = () => setIsPlaying(false);
  }, []);

  /* ── Waveform drawing ── */
  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray);

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
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
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
  }, [isRecording]);

  useEffect(() => {
    if (analyserRef.current && (wizardStep === "environment" || wizardStep === "recording")) {
      drawWaveform();
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyserRef.current, wizardStep, drawWaveform]);

  /* ── Environment / Mic setup ── */
  const checkEnvironment = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: false, sampleRate: { ideal: 48000, min: 44100 } },
      });
      const ctx = new AudioContext({ sampleRate: 48000 });
      const source = ctx.createMediaStreamSource(stream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 2048;
      source.connect(analyserNode);
      audioContextRef.current = ctx;
      analyserRef.current = analyserNode;
      streamRef.current = stream;
      setHasPermission(true);
      setEnvironmentChecked(true);
      toast({ title: "Microphone Connected", description: "Your microphone is ready. Noise suppression is enabled." });
    } catch {
      setHasPermission(false);
      toast({ title: "Microphone Access Required", description: "Please allow microphone access to continue.", variant: "destructive" });
    }
  };

  const stopMicrophone = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") audioContextRef.current.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = null; }
  }, []);

  /* ── Recording controls ── */
  const startRecording = async () => {
    if (!streamRef.current) { await checkEnvironment(); return; }
    try {
      // Setup audio level monitoring
      const analyser = analyserRef.current!;
      const bufferLength = analyser.frequencyBinCount;
      const freqData = new Uint8Array(bufferLength);

      const updateAudioLevel = () => {
        if (analyserRef.current && !isPaused) {
          analyserRef.current.getByteFrequencyData(freqData);
          let sum = 0, max = 0;
          for (let i = 0; i < bufferLength; i++) { sum += freqData[i] * freqData[i]; max = Math.max(max, freqData[i]); }
          const rms = Math.sqrt(sum / bufferLength);
          const normalizedLevel = Math.min(1, Math.max(0, rms / 128));
          const normalizedMax = max / 255;
          setAudioLevel(normalizedLevel * 100);

          // Quality warnings (debounced)
          if (Math.random() < 0.1) {
            const warnings: string[] = [];
            if (normalizedMax > 0.95) warnings.push("Audio is clipping! Move further from mic.");
            else if (normalizedLevel < 0.05) warnings.push("Too quiet! Speak louder or move closer.");
            else if (normalizedLevel < 0.1) warnings.push("Audio level is low.");
            if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
            warningTimeoutRef.current = setTimeout(() => setQualityWarnings(warnings), 500);
          }
        }
        audioLevelAnimationRef.current = requestAnimationFrame(updateAudioLevel);
      };

      // Setup MediaRecorder
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/mp4";
      }

      mediaRecorderRef.current = new MediaRecorder(streamRef.current, { mimeType });
      const audioChunks: Blob[] = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        await processRecording(audioBlob);
      };

      mediaRecorderRef.current.onerror = () => {
        toast({ title: "Recording Error", description: "An error occurred while recording. Please try again.", variant: "destructive" });
      };

      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setQualityWarnings([]);
      mediaRecorderRef.current.start(1000);

      setRecordings((prev) => prev.map((rec, idx) => idx === currentPhase ? { ...rec, status: "recording" as const } : rec));

      // Timer with auto-stop
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          const maxDur = RECORDING_PROMPTS[currentPhase].maxDuration;
          if (newTime >= maxDur) {
            stopRecording();
            toast({ title: "Max Duration Reached", description: "Recording stopped automatically." });
          } else if (newTime === maxDur - 5) {
            toast({ title: "5 Seconds Remaining", description: "Recording will stop soon." });
          }
          return newTime;
        });
      }, 1000);

      updateAudioLevel();
    } catch {
      toast({ title: "Recording Failed", description: "Could not access microphone. Please check permissions.", variant: "destructive" });
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      toast({ title: "Recording Paused", description: "Press Space or Resume to continue." });
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      recordingTimerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
      toast({ title: "Recording Resumed", description: "Continue speaking..." });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (isRecording || isPaused)) {
      setIsRecording(false);
      setIsPaused(false);
      setQualityWarnings([]);
      mediaRecorderRef.current.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioLevelAnimationRef.current) cancelAnimationFrame(audioLevelAnimationRef.current);
      if (warningTimeoutRef.current) { clearTimeout(warningTimeoutRef.current); warningTimeoutRef.current = null; }
      setRecordings((prev) => prev.map((rec, idx) => idx === currentPhase ? { ...rec, status: "processing" as const } : rec));
    }
  };

  const processRecording = async (audioBlob: Blob) => {
    const prompt = RECORDING_PROMPTS[currentPhase];
    const duration = recordingTime;

    const quality = { score: Math.min(95, Math.max(30, 70 + Math.random() * 20)), issues: [] as string[], recommendations: [] as string[] };
    if (duration < prompt.minDuration) { quality.issues.push(`Recording too short (min ${prompt.minDuration}s)`); quality.score -= 20; quality.recommendations.push(`Record for at least ${prompt.minDuration} seconds`); }
    if (duration > prompt.maxDuration) { quality.issues.push("Recording too long"); quality.score -= 10; }
    if (audioBlob.size < 1000) { quality.issues.push("Audio file is too small"); quality.score -= 15; }

    setRecordings((prev) => prev.map((rec, idx) =>
      idx === currentPhase ? { ...rec, blob: audioBlob, duration, quality, status: "completed" as const } : rec
    ));

    if (quality.score >= 80) toast({ title: "Great Recording!", description: `Quality score: ${Math.round(quality.score)}/100` });
    else if (quality.score >= 60) toast({ title: "Good Recording", description: `Quality score: ${Math.round(quality.score)}/100` });
    else toast({ title: "Consider Retaking", description: `Quality score: ${Math.round(quality.score)}/100`, variant: "destructive" });
  };

  const retakeRecording = () => {
    setRecordings((prev) => prev.map((rec, idx) =>
      idx === currentPhase ? { ...rec, blob: null, duration: 0, quality: { score: 0, issues: [], recommendations: [] }, status: "pending" as const } : rec
    ));
    setRecordingTime(0);
  };

  /* ── Playback ── */
  const playRecording = (index: number) => {
    const recording = recordings[index];
    if (!recording.blob || !audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); return; }
    const audioUrl = URL.createObjectURL(recording.blob);
    audioRef.current.src = audioUrl;
    audioRef.current.playbackRate = playbackSpeed;
    audioRef.current.play();
    setIsPlaying(true);
    audioRef.current.onended = () => { setIsPlaying(false); URL.revokeObjectURL(audioUrl); };
  };

  const changePlaybackSpeed = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const idx = speeds.indexOf(playbackSpeed);
    const next = speeds[(idx + 1) % speeds.length];
    setPlaybackSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  /* ── File upload ── */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("audio/")) {
      setUploadedFile(file);
      setWizardStep("review");
      toast({ title: "File Uploaded", description: `${file.name} is ready for review.` });
    } else {
      toast({ title: "Invalid File", description: "Please upload an audio file (MP3, WAV, etc.)", variant: "destructive" });
    }
  };

  /* ── Phase navigation ── */
  const canProceedPhase = () => {
    const rec = recordings[currentPhase];
    return rec.status === "completed" && rec.quality.score >= 30;
  };

  const allRecordingsComplete = () => recordings.every((r) => r.status === "completed" && r.quality.score >= 30);

  const totalDuration = recordings.reduce((acc, r) => acc + r.duration, 0);
  const completedCount = recordings.filter((r) => r.status === "completed").length;

  /* ── Step 1: Create voice record via API ── */
  const handleNameSubmit = async () => {
    if (!voiceName.trim()) return;
    setError(null);
    setUpgradePrompt(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/voices/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: voiceName }) });
      const data = await res.json();
      if (!res.ok) {
        if (data.upgradeRequired && data.upgradePrompt) setUpgradePrompt(data.upgradePrompt);
        else setError(data.error ?? "Failed to create voice");
        return;
      }
      setVoiceId(data.voiceId);
      setUploadMode(data.uploadMode ?? "direct");
      if (data.uploadMode === "s3" && data.uploadUrl) setUploadUrl(data.uploadUrl);
      setWizardStep("environment");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Combine all recordings and upload ── */
  const handleCreateVoice = async () => {
    if (!voiceId) return;

    // Combine all recording blobs into one
    const blobs = recordings.filter((r) => r.blob).map((r) => r.blob!);
    let audioSource: Blob | File;

    if (uploadedFile) {
      audioSource = uploadedFile;
    } else if (blobs.length > 0) {
      audioSource = new Blob(blobs, { type: blobs[0].type });
    } else {
      toast({ title: "No Recordings", description: "Please complete the recordings first.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setWizardStep("processing");
    setStatus("processing");
    setError(null);

    try {
      const file = audioSource instanceof File ? audioSource : new File([audioSource], "recording.webm", { type: "audio/webm" });

      if (uploadMode === "s3" && uploadUrl) {
        const uploadRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "audio/mpeg" }, body: file });
        if (!uploadRes.ok) throw new Error("S3 upload failed");
      } else {
        const formData = new FormData();
        formData.append("voiceId", voiceId);
        formData.append("audio", file);
        const uploadRes = await fetch("/api/voices/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) { const data = await uploadRes.json().catch(() => ({})); throw new Error(data.error || "Upload failed"); }
      }

      const processRes = await fetch("/api/voices/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceId }) });
      const processData = await processRes.json();
      setStatus(processData.status ?? "failed");

      if (processData.status === "ready") {
        toast({ title: "Voice Clone Created!", description: `${voiceName}'s voice is ready to use.` });
        setTimeout(() => router.push("/dashboard"), 2500);
      }
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Processing failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

  const canProceed = voiceName.trim().length >= 2;

  if (authLoading) {
    return (<div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>);
  }

  const currentPrompt = RECORDING_PROMPTS[currentPhase];
  const currentRecording = recordings[currentPhase];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 text-foreground">
      <audio ref={audioRef} preload="none" />
      <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
      <Nav plan={plan} />

      <main className="pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              Voice Cloning Studio
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Clone a Family Voice</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Record 8 voice samples covering different speech patterns, emotions, and styles for the best voice clone quality
            </p>
          </div>

          {/* Step indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between max-w-xl mx-auto">
              {wizardSteps.map((step, index) => (
                <div key={step.id} className="flex flex-col items-center gap-1">
                  <div className="flex items-center">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm",
                      index < currentStepIndex && "bg-primary text-primary-foreground shadow-primary/30",
                      index === currentStepIndex && "bg-primary text-primary-foreground ring-4 ring-primary/25 shadow-primary/30",
                      index > currentStepIndex && "bg-muted/70 text-muted-foreground border-2 border-border"
                    )}>
                      {index < currentStepIndex ? "\u2713" : index + 1}
                    </div>
                    {index < wizardSteps.length - 1 && (
                      <div className={cn("w-6 sm:w-10 h-0.5 mx-1", index < currentStepIndex ? "bg-primary" : "bg-border")} />
                    )}
                  </div>
                  <span className={cn("text-[10px] font-medium tracking-wide hidden sm:block", index === currentStepIndex ? "text-primary" : "text-muted-foreground")}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Step 1: Name ─── */}
          {wizardStep === "name" && (
            <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
              <CardContent className="p-6 sm:p-8 space-y-8">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-green-600 flex items-center justify-center mb-6 shadow-lg shadow-primary/25">
                    <span className="text-5xl">&#127908;</span>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Who will be reading to your kids?</h2>
                  <p className="text-muted-foreground">Give your voice clone a memorable name</p>
                </div>

                <div className="max-w-sm mx-auto space-y-4">
                  <Input value={voiceName} onChange={(e) => setVoiceName(e.target.value)} placeholder='e.g. "Grandma Sue", "Dad"' className="h-12 text-lg text-center" maxLength={50} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  {[
                    { icon: "8 Phases", title: "Multi-Phase Recording", desc: "Captures baseline, emotions, storytelling & more" },
                    { icon: "AI", title: "AI Enhanced", desc: "Advanced processing for natural-sounding voice" },
                    { icon: "2min", title: "~2 Minute Target", desc: "Eight short recordings combined for quality" },
                  ].map((f) => (
                    <div key={f.title} className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                      <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-1 rounded">{f.icon}</span>
                      <div>
                        <p className="font-medium text-sm">{f.title}</p>
                        <p className="text-xs text-muted-foreground">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                {upgradePrompt && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-4">
                    <p className="font-semibold text-amber-900">Voice profile limit reached</p>
                    <p className="text-sm text-amber-700">{upgradePrompt}</p>
                    <div className="flex gap-3">
                      <Link href="/pricing" className="flex-1 inline-flex h-9 items-center justify-center rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700">View Plans</Link>
                      <Button variant="outline" onClick={() => setUpgradePrompt(null)} className="flex-1">Dismiss</Button>
                    </div>
                  </div>
                )}

                {!upgradePrompt && (
                  <div className="flex gap-4 pt-2">
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!canProceed || isLoading} className="flex-1 gap-2">
                      Upload Audio Instead
                    </Button>
                    <Button onClick={handleNameSubmit} disabled={!canProceed || isLoading} className="flex-1 gap-2">
                      {isLoading ? "Creating..." : "Start Recording \u2192"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── Step 2: Environment Check ─── */}
          {wizardStep === "environment" && (
            <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Environment Check</h2>
                  <p className="text-muted-foreground">Let&apos;s make sure your recording environment is optimal</p>
                </div>

                <div className="bg-muted/30 rounded-xl p-6 space-y-4">
                  <canvas ref={canvasRef} width={600} height={100} className="w-full h-24 rounded-lg bg-slate-900" />
                  {environmentChecked && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Audio Level</span>
                        <span className="text-sm font-medium">{Math.round(audioLevel)}%</span>
                      </div>
                      <Progress value={audioLevel} className="h-2" />
                      <div className={cn("flex items-center gap-2 p-3 rounded-lg",
                        noiseLevel === "low" && "bg-green-500/10 text-green-600",
                        noiseLevel === "medium" && "bg-yellow-500/10 text-yellow-600",
                        noiseLevel === "high" && "bg-red-500/10 text-red-600"
                      )}>
                        <span className="text-sm font-medium">
                          {noiseLevel === "low" ? "Excellent! Your environment is quiet" : noiseLevel === "medium" ? "Some background noise detected" : "Too much noise \u2014 find a quieter spot"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { n: "1", title: "Find a quiet room", desc: "Close windows and doors" },
                    { n: "2", title: "Turn off fans & AC", desc: "Minimize humming sounds" },
                    { n: "3", title: "Position properly", desc: "6-8 inches from microphone" },
                    { n: "4", title: "Speak naturally", desc: "Normal pace and volume" },
                  ].map((tip) => (
                    <div key={tip.n} className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-primary font-bold text-sm">{tip.n}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{tip.title}</p>
                        <p className="text-xs text-muted-foreground">{tip.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => { stopMicrophone(); setWizardStep("name"); }} className="gap-2">\u2190 Back</Button>
                  {!environmentChecked ? (
                    <Button onClick={checkEnvironment} className="flex-1 gap-2">Check Microphone</Button>
                  ) : (
                    <Button onClick={() => setWizardStep("recording")} className="flex-1 gap-2" disabled={noiseLevel === "high"}>
                      Continue to Recording \u2192
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Step 3: 8-Phase Recording ─── */}
          {wizardStep === "recording" && (
            <div className="space-y-4">
              {/* Total progress & phase overview */}
              <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <h3 className="text-lg font-bold">Voice Recording: 8 Phases</h3>
                    <Badge variant="outline">{completedCount}/8 Complete</Badge>
                  </div>

                  {/* Total duration bar */}
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">Total Sample Duration</span>
                      <span className="text-muted-foreground">{formatTime(totalDuration)} / 2:00 target</span>
                    </div>
                    <Progress value={Math.min(100, (totalDuration / 120) * 100)} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">Complete all 8 phases to reach the 2-minute target for optimal voice cloning quality.</p>
                  </div>

                  {/* 8-step grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 sm:gap-2">
                    {RECORDING_PROMPTS.map((prompt, index) => {
                      const rec = recordings[index];
                      const isActive = index === currentPhase;
                      const isCompleted = rec.status === "completed";
                      return (
                        <button
                          key={prompt.id}
                          onClick={() => { if (!isRecording && !isPaused) setCurrentPhase(index); }}
                          disabled={isRecording || isPaused}
                          className={cn(
                            "flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors cursor-pointer",
                            isActive && "bg-primary/10 border-2 border-primary",
                            isCompleted && !isActive && "bg-green-900/30 border border-green-700",
                            !isActive && !isCompleted && "hover:bg-muted/50"
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium",
                            isCompleted ? "bg-green-500 text-white" :
                              isActive ? "bg-primary text-primary-foreground" :
                                "bg-muted text-muted-foreground"
                          )}>
                            {isCompleted ? "\u2713" : index + 1}
                          </div>
                          <span className="text-[10px] text-center font-medium leading-tight hidden sm:block text-foreground">
                            {prompt.title.replace("Phase ", "").replace(/^\d+:\s*/, "")}
                          </span>
                          {isCompleted && (
                            <span className="text-[10px] text-green-500">{rec.duration}s</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Current phase: script + controls */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Script & instructions */}
                <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {currentPrompt.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <Alert>
                      <AlertDescription>{currentPrompt.description}</AlertDescription>
                    </Alert>

                    <div className="p-4 bg-gradient-to-br from-primary/5 to-green-500/10 border border-primary/20 rounded-xl">
                      <p className="text-sm leading-relaxed">&quot;{currentPrompt.text}&quot;</p>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Duration: {currentPrompt.minDuration}-{currentPrompt.maxDuration}s</span>
                      <span className={cn("font-mono font-bold text-lg", isRecording && "text-red-500")}>
                        {formatTime(recordingTime)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Right: Recording controls */}
                <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      Recording Controls
                      {isPaused && <Badge variant="secondary" className="ml-2">Paused</Badge>}
                      {isRecording && !isPaused && <Badge variant="destructive" className="ml-2 animate-pulse">REC</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {/* Waveform */}
                    <canvas ref={canvasRef} width={600} height={80} className="w-full h-20 rounded-lg bg-slate-900" />

                    {/* Audio level */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Mic Level</span>
                        <span className="text-muted-foreground">{Math.round(audioLevel)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={cn("h-2 rounded-full transition-all duration-100",
                            audioLevel > 80 ? "bg-red-500" : audioLevel > 50 ? "bg-green-500" : audioLevel > 20 ? "bg-yellow-500" : "bg-gray-400"
                          )}
                          style={{ width: `${audioLevel}%` }}
                        />
                      </div>
                    </div>

                    {/* Quality warnings */}
                    {qualityWarnings.length > 0 && (isRecording || isPaused) && (
                      <div className="p-2 bg-amber-900/30 border border-amber-600 rounded-md text-sm text-amber-300">
                        {qualityWarnings.map((w, i) => <div key={i}>{w}</div>)}
                      </div>
                    )}

                    {/* Recording buttons */}
                    <div className="flex flex-col space-y-2">
                      {!isRecording && !isPaused ? (
                        <Button onClick={startRecording} disabled={!hasPermission} className="w-full" size="lg">
                          Start Recording (Space)
                        </Button>
                      ) : isPaused ? (
                        <div className="flex gap-2">
                          <Button onClick={resumeRecording} className="flex-1" size="lg">Resume (Space)</Button>
                          <Button onClick={stopRecording} variant="destructive" className="flex-1" size="lg">Stop & Save</Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button onClick={pauseRecording} variant="outline" className="flex-1" size="lg">Pause (Space)</Button>
                          <Button onClick={stopRecording} variant="destructive" className="flex-1" size="lg">Stop ({recordingTime}s)</Button>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      Press <kbd className="px-1 py-0.5 bg-muted rounded">Space</kbd> to pause/resume, <kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd> to stop
                    </p>

                    {/* Playback & retake for completed recording */}
                    {currentRecording.blob && (
                      <div className="space-y-2 border-t pt-3">
                        <div className="flex gap-2">
                          <Button onClick={() => playRecording(currentPhase)} variant="outline" className="flex-1">
                            {isPlaying ? "Pause" : "Play"}
                          </Button>
                          <Button onClick={changePlaybackSpeed} variant="outline" size="sm" className="w-16">{playbackSpeed}x</Button>
                          <Button onClick={retakeRecording} variant="outline" className="flex-1">Retake</Button>
                        </div>
                        <div className="text-xs text-muted-foreground text-center">
                          Duration: {currentRecording.duration}s | Quality: {Math.round(currentRecording.quality.score)}/100
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quality feedback for completed recording */}
              {currentRecording.status === "completed" && currentRecording.quality.issues.length > 0 && (
                <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <span className={cn(
                        currentRecording.quality.score >= 80 ? "text-green-500" :
                          currentRecording.quality.score >= 60 ? "text-yellow-500" : "text-red-500"
                      )}>
                        Quality: {Math.round(currentRecording.quality.score)}/100
                      </span>
                    </div>
                    {currentRecording.quality.issues.length > 0 && (
                      <ul className="text-sm text-muted-foreground list-disc list-inside">
                        {currentRecording.quality.issues.map((issue, idx) => <li key={idx}>{issue}</li>)}
                      </ul>
                    )}
                    {currentRecording.quality.recommendations.length > 0 && (
                      <ul className="text-sm text-muted-foreground list-disc list-inside">
                        {currentRecording.quality.recommendations.map((rec, idx) => <li key={idx}>{rec}</li>)}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Phase navigation */}
              <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => { stopMicrophone(); setWizardStep("environment"); }} disabled={isRecording || isPaused}>
                        \u2190 Environment
                      </Button>
                      <Button variant="outline" onClick={() => setCurrentPhase(Math.max(0, currentPhase - 1))} disabled={currentPhase === 0 || isRecording || isPaused}>
                        \u2190 Prev Phase
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      {currentPhase < RECORDING_PROMPTS.length - 1 ? (
                        <Button onClick={() => setCurrentPhase(currentPhase + 1)} disabled={!canProceedPhase() || isRecording || isPaused}>
                          Next Phase \u2192
                        </Button>
                      ) : (
                        <Button
                          onClick={() => setWizardStep("review")}
                          disabled={!allRecordingsComplete() || isRecording || isPaused}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Review All \u2192
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── Step 4: Review ─── */}
          {wizardStep === "review" && (
            <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Review Your Recordings</h2>
                  <p className="text-muted-foreground">
                    {uploadedFile
                      ? `Uploaded: ${uploadedFile.name}`
                      : `${completedCount}/8 phases recorded | Total: ${formatTime(totalDuration)}`}
                  </p>
                </div>

                {!uploadedFile && (
                  <div className="space-y-2">
                    {recordings.map((rec, index) => (
                      <div key={rec.id} className={cn("flex items-center justify-between p-3 rounded-lg border", rec.status === "completed" ? "bg-green-500/5 border-green-500/20" : "bg-muted/30 border-border")}>
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                            rec.status === "completed" ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                          )}>
                            {rec.status === "completed" ? "\u2713" : index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{RECORDING_PROMPTS[index].title}</p>
                            <p className="text-xs text-muted-foreground">
                              {rec.status === "completed" ? `${rec.duration}s | Quality: ${Math.round(rec.quality.score)}/100` : "Not recorded"}
                            </p>
                          </div>
                        </div>
                        {rec.blob && (
                          <Button variant="ghost" size="sm" onClick={() => playRecording(index)}>
                            {isPlaying ? "Pause" : "Play"}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {uploadedFile && (
                  <Card className="bg-muted/30 border-0">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <Button size="lg" variant="outline" onClick={() => {
                          if (!audioRef.current || !uploadedFile) return;
                          if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
                          else { audioRef.current.src = URL.createObjectURL(uploadedFile); audioRef.current.play(); setIsPlaying(true); }
                        }} className="w-14 h-14 rounded-full p-0">
                          {isPlaying ? "\u23F8" : "\u25B6"}
                        </Button>
                        <div>
                          <p className="font-medium">{voiceName}</p>
                          <p className="text-sm text-muted-foreground">{uploadedFile.name}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <p className="font-medium text-sm text-blue-400 mb-1">Quality Check</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>All 8 phases recorded with clear audio?</li>
                    <li>Different emotions and tones captured?</li>
                    <li>Minimal background noise throughout?</li>
                    <li>Total duration near 2 minutes target?</li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => { setWizardStep("recording"); setCurrentPhase(0); }} className="gap-2">
                    \u2190 Re-record
                  </Button>
                  <Button onClick={handleCreateVoice} disabled={isLoading || (!allRecordingsComplete() && !uploadedFile)} className="flex-1 gap-2 bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90">
                    {isLoading ? "Creating..." : "Create Voice Clone"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Step 5: Processing ─── */}
          {wizardStep === "processing" && (
            <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
              <CardContent className="p-6 sm:p-8 space-y-8 text-center">
                <div>
                  <div className={cn(
                    "w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 shadow-lg",
                    status === "ready" ? "bg-green-500/20" : status === "failed" ? "bg-red-500/20" : "bg-gradient-to-br from-primary via-green-600 to-amber-500 animate-pulse shadow-primary/25"
                  )}>
                    <span className="text-4xl">{status === "ready" ? "\uD83C\uDF89" : status === "failed" ? "\u274C" : "\u2728"}</span>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">
                    {status === "ready" ? `${voiceName}'s Voice is Ready!` : status === "failed" ? "Something Went Wrong" : "Creating Voice Clone..."}
                  </h2>
                  <p className="text-muted-foreground">
                    {status === "ready"
                      ? "The voice clone has been created from all 8 phases. Redirecting to dashboard..."
                      : status === "failed"
                        ? error || "Voice cloning failed. Try different audio samples."
                        : `Combining ${completedCount} recordings and processing ${voiceName}'s voice. This usually takes about 30 seconds.`}
                  </p>
                </div>

                {status === "processing" && (
                  <div className="max-w-sm mx-auto">
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full w-2/3 rounded-full bg-primary animate-pulse" />
                    </div>
                  </div>
                )}

                {status === "failed" && (
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" onClick={() => { setWizardStep("recording"); setCurrentPhase(0); setStatus("processing"); setError(null); }}>
                      Try Again
                    </Button>
                    <Button asChild><Link href="/voice-cloning">Voice Cloning Studio</Link></Button>
                  </div>
                )}

                {status === "ready" && (
                  <Button asChild size="lg"><Link href="/dashboard">Go to Dashboard \u2192</Link></Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
