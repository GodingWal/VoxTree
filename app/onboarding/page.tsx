"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type WizardStep = "name" | "environment" | "record" | "review" | "processing";

const SAMPLE_SCRIPTS = [
  {
    id: "greeting",
    title: "Natural Greeting",
    text: "Hello! My name is [say your name]. I'm excited to create my personal voice clone today. This technology is truly amazing, and I can't wait to hear how it turns out.",
    duration: "15-20 seconds",
  },
  {
    id: "story",
    title: "Short Story",
    text: "Once upon a time, in a land far away, there lived a curious little fox who loved to explore. Every morning, the fox would venture into the forest, discovering new paths and making friends along the way.",
    duration: "20-25 seconds",
  },
  {
    id: "variety",
    title: "Emotional Range",
    text: "I'm so happy to see you today! Wait, did you hear that noise? Oh, it's nothing to worry about. Anyway, let me tell you something important. Are you ready? Here it comes!",
    duration: "15-20 seconds",
  },
];

export default function OnboardingPage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auth & plan
  const [plan, setPlan] = useState("free");
  const [authLoading, setAuthLoading] = useState(true);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>("name");
  const [voiceName, setVoiceName] = useState("");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"s3" | "direct">("direct");
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);

  // Recording state
  const [selectedScript, setSelectedScript] = useState(SAMPLE_SCRIPTS[0]);
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

  // Processing state
  const [status, setStatus] = useState<"processing" | "ready" | "failed">("processing");
  const [error, setError] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const steps = [
    { id: "name", label: "Name" },
    { id: "environment", label: "Setup" },
    { id: "record", label: "Record" },
    { id: "review", label: "Review" },
    { id: "processing", label: "Create" },
  ];
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  /* ── Auth check ── */
  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("plan")
        .eq("id", user.id)
        .single();
      if (data?.plan) setPlan(data.plan);
      setAuthLoading(false);
    }
    check();
  }, []);

  /* ── Microphone helpers ── */
  const stopMicrophone = useCallback(() => {
    audioStream?.getTracks().forEach((t) => t.stop());
    setAudioStream(null);
    audioContext?.close();
    setAudioContext(null);
    setAnalyser(null);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, [audioStream, audioContext]);

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
  }, [analyser, isRecording]);

  useEffect(() => {
    if (
      analyser &&
      (currentStep === "environment" || currentStep === "record")
    ) {
      drawWaveform();
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, currentStep, drawWaveform]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      audioStream?.getTracks().forEach((t) => t.stop());
      audioContext?.close();
    };
  }, [audioStream, audioContext]);

  useEffect(() => {
    if (audioRef.current)
      audioRef.current.onended = () => setIsPlaying(false);
  }, []);

  /* ── Environment check ── */
  const checkEnvironment = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
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
      toast({
        title: "Microphone Connected",
        description:
          "Your microphone is ready. Noise suppression is enabled.",
      });
    } catch {
      toast({
        title: "Microphone Access Required",
        description: "Please allow microphone access to continue.",
        variant: "destructive",
      });
    }
  };

  /* ── Recording ── */
  const startRecording = async () => {
    if (!audioStream) {
      await checkEnvironment();
      return;
    }
    try {
      const recorder = new MediaRecorder(audioStream, {
        mimeType: "audio/webm;codecs=opus",
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        setRecordedAudio(new Blob(chunks, { type: "audio/webm" }));
        if (recordingTimerRef.current)
          clearInterval(recordingTimerRef.current);
      };
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(
        () => setRecordingTime((p) => p + 1),
        1000
      );
    } catch {
      toast({
        title: "Recording Error",
        description: "Could not start recording.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingTimerRef.current)
        clearInterval(recordingTimerRef.current);
    }
  };

  /* ── File upload ── */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("audio/")) {
      setUploadedFile(file);
      setRecordedAudio(null);
      setCurrentStep("review");
      toast({
        title: "File Uploaded",
        description: `${file.name} is ready for review.`,
      });
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload an audio file (MP3, WAV, etc.)",
        variant: "destructive",
      });
    }
  };

  /* ── Playback ── */
  const playAudio = () => {
    if (!audioRef.current) return;
    const source = recordedAudio || uploadedFile;
    if (!source) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.src = URL.createObjectURL(source);
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  /* ── Step 1: Create voice record ── */
  const handleNameSubmit = async () => {
    if (!voiceName.trim()) return;
    setError(null);
    setUpgradePrompt(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/voices/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: voiceName }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.upgradeRequired && data.upgradePrompt) {
          setUpgradePrompt(data.upgradePrompt);
        } else {
          setError(data.error ?? "Failed to create voice");
        }
        return;
      }

      setVoiceId(data.voiceId);
      setUploadMode(data.uploadMode ?? "direct");
      if (data.uploadMode === "s3" && data.uploadUrl) {
        setUploadUrl(data.uploadUrl);
      }
      setCurrentStep("environment");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Final: Upload & process ── */
  const handleCreateVoice = async () => {
    const audioSource = recordedAudio || uploadedFile;
    if (!audioSource || !voiceId) return;
    setIsLoading(true);
    setCurrentStep("processing");
    setStatus("processing");
    setError(null);

    try {
      const file =
        audioSource instanceof File
          ? audioSource
          : new File([audioSource], "recording.webm", {
              type: "audio/webm",
            });

      if (uploadMode === "s3" && uploadUrl) {
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "audio/mpeg" },
          body: file,
        });
        if (!uploadRes.ok) throw new Error("S3 upload failed");
      } else {
        const formData = new FormData();
        formData.append("voiceId", voiceId);
        formData.append("audio", file);
        const uploadRes = await fetch("/api/voices/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          throw new Error(data.error || "Upload failed");
        }
      }

      // Process voice
      const processRes = await fetch("/api/voices/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });
      const processData = await processRes.json();
      setStatus(processData.status ?? "failed");

      if (processData.status === "ready") {
        toast({
          title: "Voice Clone Created!",
          description: `${voiceName}'s voice is ready to use.`,
        });
        setTimeout(() => router.push("/dashboard"), 2500);
      }
    } catch (err) {
      setStatus("failed");
      setError(
        err instanceof Error ? err.message : "Processing failed."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const hasAudio = recordedAudio || uploadedFile;
  const canProceed = voiceName.trim().length >= 2;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 text-foreground">
      <audio ref={audioRef} preload="none" />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      <Nav plan={plan} />

      <main className="pt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              🎤 Voice Cloning Studio
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">
              Clone a Family Voice
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Record or upload a voice sample and we&apos;ll create a digital
              clone for personalized stories and videos
            </p>
          </div>

          {/* Step indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between max-w-lg mx-auto">
              {steps.map((step, index) => (
                <div key={step.id} className="flex flex-col items-center gap-1">
                  <div className="flex items-center">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm",
                        index < currentStepIndex &&
                          "bg-primary text-primary-foreground shadow-primary/30",
                        index === currentStepIndex &&
                          "bg-primary text-primary-foreground ring-4 ring-primary/25 shadow-primary/30",
                        index > currentStepIndex &&
                          "bg-muted/70 text-muted-foreground border-2 border-border"
                      )}
                    >
                      {index < currentStepIndex ? "✓" : index + 1}
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={cn(
                          "w-6 sm:w-10 h-0.5 mx-1",
                          index < currentStepIndex
                            ? "bg-primary"
                            : "bg-border"
                        )}
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium tracking-wide hidden sm:block",
                      index === currentStepIndex
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Wizard card */}
          <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
            <CardContent className="p-6 sm:p-8">
              {/* ─── Step 1: Name ─── */}
              {currentStep === "name" && (
                <div className="space-y-8">
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-green-600 flex items-center justify-center mb-6 shadow-lg shadow-primary/25">
                      <span className="text-5xl">🎤</span>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">
                      Who will be reading to your kids?
                    </h2>
                    <p className="text-muted-foreground">
                      Give your voice clone a memorable name
                    </p>
                  </div>

                  <div className="max-w-sm mx-auto space-y-4">
                    <Input
                      value={voiceName}
                      onChange={(e) => setVoiceName(e.target.value)}
                      placeholder='e.g. "Grandma Sue", "Dad"'
                      className="h-12 text-lg text-center"
                      maxLength={50}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    {[
                      {
                        icon: "🛡️",
                        title: "Noise Removal",
                        desc: "Background noise is automatically filtered",
                      },
                      {
                        icon: "✨",
                        title: "AI Enhanced",
                        desc: "Advanced processing for clear audio",
                      },
                      {
                        icon: "🎧",
                        title: "High Quality",
                        desc: "Studio-grade voice cloning",
                      },
                    ].map((f) => (
                      <div
                        key={f.title}
                        className="flex items-start gap-3 p-4 rounded-lg bg-muted/50"
                      >
                        <span className="text-xl">{f.icon}</span>
                        <div>
                          <p className="font-medium text-sm">{f.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {error && (
                    <p className="text-sm text-destructive text-center">
                      {error}
                    </p>
                  )}

                  {upgradePrompt && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-4">
                      <p className="font-semibold text-amber-900">
                        Voice profile limit reached
                      </p>
                      <p className="text-sm text-amber-700">
                        {upgradePrompt}
                      </p>
                      <div className="flex gap-3">
                        <Link
                          href="/pricing"
                          className="flex-1 inline-flex h-9 items-center justify-center rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700"
                        >
                          View Plans
                        </Link>
                        <Button
                          variant="outline"
                          onClick={() => setUpgradePrompt(null)}
                          className="flex-1"
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}

                  {!upgradePrompt && (
                    <div className="flex gap-4 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!canProceed || isLoading}
                        className="flex-1 gap-2"
                      >
                        📁 Upload Audio Instead
                      </Button>
                      <Button
                        onClick={handleNameSubmit}
                        disabled={!canProceed || isLoading}
                        className="flex-1 gap-2"
                      >
                        {isLoading
                          ? "Creating..."
                          : "Record Voice →"}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Step 2: Environment Check ─── */}
              {currentStep === "environment" && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">
                      Environment Check
                    </h2>
                    <p className="text-muted-foreground">
                      Let&apos;s make sure your recording environment is
                      optimal
                    </p>
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
                          <span className="text-sm font-medium">
                            {Math.round(audioLevel)}%
                          </span>
                        </div>
                        <Progress value={audioLevel} className="h-2" />

                        <div
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg",
                            noiseLevel === "low" &&
                              "bg-green-500/10 text-green-600",
                            noiseLevel === "medium" &&
                              "bg-yellow-500/10 text-yellow-600",
                            noiseLevel === "high" &&
                              "bg-red-500/10 text-red-600"
                          )}
                        >
                          <span className="text-lg">
                            {noiseLevel === "low"
                              ? "✅"
                              : noiseLevel === "medium"
                                ? "⚠️"
                                : "🔴"}
                          </span>
                          <span className="text-sm font-medium">
                            {noiseLevel === "low"
                              ? "Excellent! Your environment is quiet"
                              : noiseLevel === "medium"
                                ? "Some background noise detected"
                                : "Too much noise — find a quieter spot"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        n: "1",
                        title: "Find a quiet room",
                        desc: "Close windows and doors",
                      },
                      {
                        n: "2",
                        title: "Turn off fans & AC",
                        desc: "Minimize humming sounds",
                      },
                      {
                        n: "3",
                        title: "Position properly",
                        desc: "6-8 inches from microphone",
                      },
                      {
                        n: "4",
                        title: "Speak naturally",
                        desc: "Normal pace and volume",
                      },
                    ].map((tip) => (
                      <div
                        key={tip.n}
                        className="flex items-start gap-3 p-4 rounded-lg border bg-card"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-primary font-bold text-sm">
                            {tip.n}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{tip.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {tip.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        stopMicrophone();
                        setCurrentStep("name");
                      }}
                      className="gap-2"
                    >
                      ← Back
                    </Button>
                    {!environmentChecked ? (
                      <Button
                        onClick={checkEnvironment}
                        className="flex-1 gap-2"
                      >
                        🎤 Check Microphone
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setCurrentStep("record")}
                        className="flex-1 gap-2"
                        disabled={noiseLevel === "high"}
                      >
                        Continue to Recording →
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Step 3: Record ─── */}
              {currentStep === "record" && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">
                      Record {voiceName}&apos;s Voice
                    </h2>
                    <p className="text-muted-foreground">
                      Read the script below naturally for best results
                    </p>
                  </div>

                  {/* Script selector */}
                  <div className="flex gap-2 justify-center flex-wrap">
                    {SAMPLE_SCRIPTS.map((script) => (
                      <Button
                        key={script.id}
                        variant={
                          selectedScript.id === script.id
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => setSelectedScript(script)}
                        disabled={isRecording}
                      >
                        {script.title}
                      </Button>
                    ))}
                  </div>

                  {/* Script to read */}
                  <div className="bg-gradient-to-br from-primary/5 to-green-500/10 border border-primary/20 rounded-xl p-6">
                    <p className="font-medium text-sm mb-3">
                      Script to Read ({selectedScript.duration})
                    </p>
                    <p className="text-lg leading-relaxed">
                      &quot;{selectedScript.text}&quot;
                    </p>
                  </div>

                  {/* Waveform & controls */}
                  <div className="bg-muted/30 rounded-xl p-6 space-y-4">
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={80}
                      className="w-full h-20 rounded-lg bg-slate-900"
                    />

                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <div
                          className={cn(
                            "text-4xl font-mono font-bold",
                            isRecording && "text-red-500"
                          )}
                        >
                          {formatTime(recordingTime)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isRecording ? "Recording..." : "Ready"}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <Button
                        size="lg"
                        variant={isRecording ? "destructive" : "default"}
                        onClick={
                          isRecording ? stopRecording : startRecording
                        }
                        className={cn(
                          "w-20 h-20 rounded-full p-0 transition-all",
                          isRecording && "animate-pulse"
                        )}
                      >
                        {isRecording ? (
                          <div className="w-6 h-6 bg-white rounded-sm" />
                        ) : (
                          <span className="text-2xl">🎤</span>
                        )}
                      </Button>
                    </div>

                    <p className="text-center text-sm text-muted-foreground">
                      {isRecording
                        ? "Click to stop recording"
                        : "Click to start recording"}
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep("environment")}
                      className="gap-2"
                      disabled={isRecording}
                    >
                      ← Back
                    </Button>
                    <Button
                      onClick={() => setCurrentStep("review")}
                      disabled={!recordedAudio || isRecording}
                      className="flex-1 gap-2"
                    >
                      Review Recording →
                    </Button>
                  </div>
                </div>
              )}

              {/* ─── Step 4: Review ─── */}
              {currentStep === "review" && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                      <span className="text-3xl">✅</span>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">
                      Review Your Recording
                    </h2>
                    <p className="text-muted-foreground">
                      Listen to make sure it sounds clear and natural
                    </p>
                  </div>

                  <Card className="bg-muted/30 border-0">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Button
                            size="lg"
                            variant="outline"
                            onClick={playAudio}
                            className="w-14 h-14 rounded-full p-0"
                          >
                            {isPlaying ? "⏸" : "▶️"}
                          </Button>
                          <div>
                            <p className="font-medium">{voiceName}</p>
                            <p className="text-sm text-muted-foreground">
                              {uploadedFile
                                ? uploadedFile.name
                                : `${formatTime(recordingTime)} recording`}
                            </p>
                          </div>
                        </div>
                        <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                          Noise Filtered
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <p className="font-medium text-sm text-blue-600 mb-1">
                      Quality Check
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Is the voice clear and audible?</li>
                      <li>Was the full script read?</li>
                      <li>Is there minimal background noise?</li>
                    </ul>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRecordedAudio(null);
                        setUploadedFile(null);
                        setCurrentStep("record");
                      }}
                      className="gap-2"
                    >
                      🔄 Re-record
                    </Button>
                    <Button
                      onClick={handleCreateVoice}
                      disabled={isLoading}
                      className="flex-1 gap-2 bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90"
                    >
                      {isLoading ? "Creating..." : "✨ Create Voice Clone"}
                    </Button>
                  </div>
                </div>
              )}

              {/* ─── Step 5: Processing ─── */}
              {currentStep === "processing" && (
                <div className="space-y-8 text-center">
                  <div>
                    <div
                      className={cn(
                        "w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 shadow-lg",
                        status === "ready"
                          ? "bg-green-500/20"
                          : status === "failed"
                            ? "bg-red-500/20"
                            : "bg-gradient-to-br from-primary via-green-600 to-amber-500 animate-pulse shadow-primary/25"
                      )}
                    >
                      <span className="text-4xl">
                        {status === "ready"
                          ? "🎉"
                          : status === "failed"
                            ? "❌"
                            : "✨"}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">
                      {status === "ready"
                        ? `${voiceName}'s Voice is Ready!`
                        : status === "failed"
                          ? "Something Went Wrong"
                          : "Creating Voice Clone..."}
                    </h2>
                    <p className="text-muted-foreground">
                      {status === "ready"
                        ? "The voice clone has been created. Redirecting to dashboard..."
                        : status === "failed"
                          ? error ||
                            "Voice cloning failed. Try a different audio sample."
                          : `We're processing ${voiceName}'s voice. This usually takes about 30 seconds.`}
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
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRecordedAudio(null);
                          setUploadedFile(null);
                          setCurrentStep("record");
                          setStatus("processing");
                          setError(null);
                        }}
                      >
                        🔄 Try Again
                      </Button>
                      <Button asChild>
                        <Link href="/voice-cloning">
                          Voice Cloning Studio
                        </Link>
                      </Button>
                    </div>
                  )}

                  {status === "ready" && (
                    <Button asChild size="lg">
                      <Link href="/dashboard">Go to Dashboard →</Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
