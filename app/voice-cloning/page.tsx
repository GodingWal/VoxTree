"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type WizardStep = "intro" | "environment" | "record" | "review" | "create";

interface VoiceProfile {
  id: string;
  name: string;
  status: "pending" | "training" | "ready" | "failed";
  created_at?: string;
}

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

export default function VoiceCloningPage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("free");
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState<WizardStep>("intro");
  const [voiceName, setVoiceName] = useState("");
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
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── initial load ── */
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const [profileRes, voicesRes] = await Promise.all([
        supabase.from("users").select("plan").eq("id", user.id).single(),
        supabase.from("family_voices").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setPlan(profileRes.data?.plan ?? "free");
      setVoiceProfiles(voicesRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  /* ── poll for training status ── */
  useEffect(() => {
    const training = voiceProfiles.some(p => p.status === "pending" || p.status === "training");
    if (!training) return;
    const interval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("family_voices").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (data) setVoiceProfiles(data);
    }, 5000);
    return () => clearInterval(interval);
  }, [voiceProfiles]);

  /* ── microphone helpers ── */
  const stopMicrophone = useCallback(() => {
    audioStream?.getTracks().forEach(t => t.stop());
    setAudioStream(null);
    audioContext?.close();
    setAudioContext(null);
    setAnalyser(null);
    if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = null; }
  }, [audioStream, audioContext]);

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
  }, [stopMicrophone]);

  /* ── waveform ── */
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
    if (analyser && (currentStep === "environment" || currentStep === "record")) drawWaveform();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [analyser, currentStep, drawWaveform]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      audioStream?.getTracks().forEach(t => t.stop());
      audioContext?.close();
    };
  }, [audioStream, audioContext]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.onended = () => setIsPlaying(false);
  }, []);

  /* ── environment check ── */
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
      toast({ title: "Microphone Connected", description: "Your microphone is ready. Noise suppression is enabled." });
    } catch {
      toast({ title: "Microphone Access Required", description: "Please allow microphone access to continue.", variant: "destructive" });
    }
  };

  /* ── recording ── */
  const startRecording = async () => {
    if (!audioStream) { await checkEnvironment(); return; }
    try {
      const recorder = new MediaRecorder(audioStream, { mimeType: "audio/webm;codecs=opus" });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        setRecordedAudio(new Blob(chunks, { type: "audio/webm" }));
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      };
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch {
      toast({ title: "Recording Error", description: "Could not start recording.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  /* ── file upload ── */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("audio/")) {
      setUploadedFile(file);
      setRecordedAudio(null);
      setCurrentStep("review");
      toast({ title: "File Uploaded", description: `${file.name} is ready for review.` });
    } else {
      toast({ title: "Invalid File", description: "Please upload an audio file (MP3, WAV, etc.)", variant: "destructive" });
    }
  };

  /* ── playback ── */
  const playRecordedAudio = () => {
    if (!audioRef.current) return;
    const source = recordedAudio || uploadedFile;
    if (!source) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else {
      audioRef.current.src = URL.createObjectURL(source);
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  /* ── create profile ── */
  const handleCreateProfile = async () => {
    const audioSource = recordedAudio || uploadedFile;
    if (!audioSource || !voiceName.trim()) return;
    setCreating(true);
    try {
      const file = audioSource instanceof File ? audioSource : new File([audioSource], "recording.webm", { type: "audio/webm" });
      const formData = new FormData();
      formData.append("name", voiceName.trim());
      formData.append("audio", file);
      const res = await fetch("/api/voice-profiles", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create voice profile");
      }
      const data = await res.json();
      toast({ title: "Voice Clone Created!", description: "Your voice is being processed. This takes about 30 seconds." });
      setSelectedProfileId(data.id);
      // Refresh voices
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: voices } = await supabase.from("family_voices").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        if (voices) setVoiceProfiles(voices);
      }
      resetWizard();
    } catch (err: unknown) {
      toast({ title: "Creation Failed", description: err instanceof Error ? err.message : "Could not create voice profile", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  /* ── delete profile ── */
  const handleDeleteProfile = async (profileId: string, profileName: string) => {
    if (!confirm(`Delete voice "${profileName}"?`)) return;
    setDeleting(profileId);
    try {
      const res = await fetch(`/api/voices/${profileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Voice Deleted", description: "The voice profile has been removed." });
      setVoiceProfiles(prev => prev.filter(p => p.id !== profileId));
      if (selectedProfileId === profileId) setSelectedProfileId(null);
    } catch {
      toast({ title: "Delete Failed", description: "Could not delete voice profile.", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  /* ── preview ── */
  const playVoicePreview = async (profileId: string) => {
    try {
      const res = await fetch(`/api/voice-profiles/${profileId}/preview`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      if (audioRef.current) {
        audioRef.current.src = URL.createObjectURL(blob);
        audioRef.current.play();
        setIsPlaying(true);
        setSelectedProfileId(profileId);
      }
    } catch {
      toast({ title: "Preview Unavailable", description: "Voice preview is not ready yet.", variant: "destructive" });
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const hasAudio = recordedAudio || uploadedFile;
  const canProceed = voiceName.trim().length >= 2;

  const steps = [
    { id: "intro", label: "Start" },
    { id: "environment", label: "Setup" },
    { id: "record", label: "Record" },
    { id: "review", label: "Review" },
    { id: "create", label: "Create" },
  ];
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 text-foreground">
      <audio ref={audioRef} preload="none" />
      <Nav plan={plan} />

      <main className="pt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              AI Voice Cloning
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Create Your Voice Clone</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Record a high-quality voice sample and we&apos;ll create a digital copy that sounds just like you
            </p>
          </div>

          {/* Step indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between max-w-md mx-auto">
              {steps.map((step, index) => (
                <div key={step.id} className="flex flex-col items-center gap-1">
                  <div className="flex items-center">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm",
                      index < currentStepIndex && "bg-primary text-primary-foreground shadow-primary/30",
                      index === currentStepIndex && "bg-primary text-primary-foreground ring-4 ring-primary/25 shadow-primary/30",
                      index > currentStepIndex && "bg-muted/70 text-muted-foreground border-2 border-border"
                    )}>
                      {index < currentStepIndex ? "✓" : index + 1}
                    </div>
                    {index < steps.length - 1 && (
                      <div className={cn("w-8 sm:w-12 h-0.5 mx-1", index < currentStepIndex ? "bg-primary" : "bg-border")} />
                    )}
                  </div>
                  <span className={cn("text-[10px] font-medium tracking-wide hidden sm:block", index === currentStepIndex ? "text-primary" : "text-muted-foreground")}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Wizard card */}
          <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
            <CardContent className="p-6 sm:p-8">

              {/* Step 1: Intro */}
              {currentStep === "intro" && (
                <div className="space-y-8">
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-green-600 flex items-center justify-center mb-6 shadow-lg shadow-primary/25">
                      <span className="text-4xl">🎤</span>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Let&apos;s Get Started</h2>
                    <p className="text-muted-foreground">First, give your voice clone a memorable name</p>
                  </div>

                  <div className="max-w-sm mx-auto space-y-4">
                    <Input
                      value={voiceName}
                      onChange={e => setVoiceName(e.target.value)}
                      placeholder="Enter voice name..."
                      className="h-12 text-lg"
                      maxLength={50}
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Examples: &quot;Dad&apos;s Voice&quot;, &quot;Grandma Mary&quot;, &quot;My Voice&quot;
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                    {[
                      { icon: "🛡️", title: "Noise Removal", desc: "Background noise is automatically filtered" },
                      { icon: "✨", title: "AI Enhanced", desc: "Advanced processing for clear audio" },
                      { icon: "🎧", title: "High Quality", desc: "Studio-grade voice cloning" },
                    ].map(f => (
                      <div key={f.title} className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                        <span className="text-xl">{f.icon}</span>
                        <div>
                          <p className="font-medium text-sm">{f.title}</p>
                          <p className="text-xs text-muted-foreground">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!canProceed} className="flex-1 gap-2">
                      Upload Audio
                    </Button>
                    <Button onClick={() => setCurrentStep("environment")} disabled={!canProceed} className="flex-1 gap-2">
                      Record Voice →
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Environment Check */}
              {currentStep === "environment" && (
                <div className="space-y-6">
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
                        <div className={cn(
                          "flex items-center gap-2 p-3 rounded-lg",
                          noiseLevel === "low" && "bg-green-500/10 text-green-600",
                          noiseLevel === "medium" && "bg-yellow-500/10 text-yellow-600",
                          noiseLevel === "high" && "bg-red-500/10 text-red-600"
                        )}>
                          <span className="text-sm font-medium">
                            {noiseLevel === "low" ? "Excellent! Your environment is quiet" : noiseLevel === "medium" ? "Some background noise detected" : "Too much noise - find a quieter spot"}
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
                    ].map(tip => (
                      <div key={tip.n} className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-primary font-bold">{tip.n}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{tip.title}</p>
                          <p className="text-xs text-muted-foreground">{tip.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setCurrentStep("intro")} className="gap-2">← Back</Button>
                    {!environmentChecked ? (
                      <Button onClick={checkEnvironment} className="flex-1 gap-2">Check Microphone</Button>
                    ) : (
                      <Button onClick={() => setCurrentStep("record")} className="flex-1 gap-2" disabled={noiseLevel === "high"}>Continue to Recording →</Button>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Record */}
              {currentStep === "record" && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Record Your Voice</h2>
                    <p className="text-muted-foreground">Read the script below naturally for best results</p>
                  </div>

                  <div className="flex gap-2 justify-center flex-wrap">
                    {SAMPLE_SCRIPTS.map(script => (
                      <Button key={script.id} variant={selectedScript.id === script.id ? "default" : "outline"} size="sm" onClick={() => setSelectedScript(script)} disabled={isRecording}>
                        {script.title}
                      </Button>
                    ))}
                  </div>

                  <div className="bg-gradient-to-br from-primary/5 to-green-500/10 border border-primary/20 rounded-xl p-6">
                    <p className="font-medium text-sm mb-3">Script to Read ({selectedScript.duration})</p>
                    <p className="text-lg leading-relaxed">&quot;{selectedScript.text}&quot;</p>
                  </div>

                  <div className="bg-muted/30 rounded-xl p-6 space-y-4">
                    <canvas ref={canvasRef} width={600} height={80} className="w-full h-20 rounded-lg bg-slate-900" />
                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <div className={cn("text-4xl font-mono font-bold", isRecording && "text-red-500")}>{formatTime(recordingTime)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{isRecording ? "Recording..." : "Ready"}</p>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <Button
                        size="lg"
                        variant={isRecording ? "destructive" : "default"}
                        onClick={isRecording ? stopRecording : startRecording}
                        className={cn("w-20 h-20 rounded-full p-0 transition-all", isRecording && "animate-pulse")}
                      >
                        {isRecording ? <div className="w-6 h-6 bg-white rounded-sm" /> : <span className="text-2xl">🎤</span>}
                      </Button>
                    </div>
                    <p className="text-center text-sm text-muted-foreground">
                      {isRecording ? "Click to stop recording" : "Click to start recording"}
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setCurrentStep("environment")} className="gap-2" disabled={isRecording}>← Back</Button>
                    <Button onClick={() => setCurrentStep("review")} disabled={!recordedAudio || isRecording} className="flex-1 gap-2">Review Recording →</Button>
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {currentStep === "review" && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                      <span className="text-3xl">✅</span>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Review Your Recording</h2>
                    <p className="text-muted-foreground">Listen to make sure it sounds clear and natural</p>
                  </div>

                  <Card className="bg-muted/30 border-0">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Button size="lg" variant="outline" onClick={playRecordedAudio} className="w-14 h-14 rounded-full p-0">
                            {isPlaying ? "⏸" : "▶️"}
                          </Button>
                          <div>
                            <p className="font-medium">{voiceName}</p>
                            <p className="text-sm text-muted-foreground">
                              {uploadedFile ? uploadedFile.name : `${formatTime(recordingTime)} recording`}
                            </p>
                          </div>
                        </div>
                        <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600">Noise Filtered</div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <p className="font-medium text-sm text-blue-600 mb-1">Quality Check</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Is your voice clear and audible?</li>
                      <li>Did you read the full script?</li>
                      <li>Is there minimal background noise?</li>
                    </ul>
                  </div>

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => { setRecordedAudio(null); setUploadedFile(null); setCurrentStep("record"); }} className="gap-2">Re-record</Button>
                    <Button onClick={() => setCurrentStep("create")} className="flex-1 gap-2">Sounds Good! →</Button>
                  </div>
                </div>
              )}

              {/* Step 5: Create */}
              {currentStep === "create" && (
                <div className="space-y-8 text-center">
                  <div>
                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary via-green-600 to-amber-500 flex items-center justify-center mb-6 shadow-lg shadow-primary/25 animate-pulse">
                      <span className="text-4xl">✨</span>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Ready to Create!</h2>
                    <p className="text-muted-foreground">
                      Your voice clone &quot;<span className="text-foreground font-medium">{voiceName}</span>&quot; will be ready in about 30 seconds
                    </p>
                  </div>

                  <Card className="bg-muted/30 border-0 max-w-sm mx-auto">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center gap-3 text-left">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-xl">🔊</span>
                        </div>
                        <div>
                          <p className="font-medium">{voiceName}</p>
                          <p className="text-sm text-muted-foreground">
                            {uploadedFile ? uploadedFile.name : `${formatTime(recordingTime)} recording`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-4 pt-2">
                        <span className="text-sm text-muted-foreground">🛡️ Noise Filtered</span>
                        <span className="text-sm text-muted-foreground">✅ Quality Verified</span>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-4 max-w-sm mx-auto">
                    <Button variant="outline" onClick={() => setCurrentStep("review")} className="gap-2">← Back</Button>
                    <Button onClick={handleCreateProfile} disabled={creating} className="flex-1 gap-2 bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90">
                      {creating ? "Creating..." : "Create Voice Clone"}
                    </Button>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

          {/* Existing voice profiles */}
          {voiceProfiles.length > 0 && (
            <div className="mt-12 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔊</span>
                <h2 className="text-xl font-semibold">Your Voice Clones</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {voiceProfiles.map(profile => (
                  <Card key={profile.id} className={cn("transition-all hover:shadow-md", selectedProfileId === profile.id && "ring-2 ring-primary")}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-11 h-11 rounded-full flex items-center justify-center ring-2",
                            profile.status === "ready" ? "bg-green-500/25 ring-green-500/50" :
                            profile.status === "training" ? "bg-amber-500/25 ring-amber-500/50" :
                            profile.status === "failed" ? "bg-red-500/25 ring-red-500/50" :
                            "bg-muted ring-border"
                          )}>
                            <span className="text-lg">
                              {profile.status === "ready" ? "🔊" : profile.status === "training" || profile.status === "pending" ? "⏳" : "⚠️"}
                            </span>
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
                            <Button variant="outline" size="sm" onClick={() => playVoicePreview(profile.id)} disabled={isPlaying && selectedProfileId === profile.id} className="text-primary border-primary/40 hover:bg-primary/10">
                              {isPlaying && selectedProfileId === profile.id ? "⏸" : "▶️"}
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => handleDeleteProfile(profile.id, profile.name)} disabled={deleting === profile.id} className="text-muted-foreground border-border hover:text-destructive hover:border-destructive/50">
                            {deleting === profile.id ? "..." : "🗑️"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {voiceProfiles.length === 0 && currentStep === "intro" && (
            <div className="text-center py-10 mt-8 rounded-xl border border-dashed border-border bg-muted/20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                <span className="text-2xl">🔊</span>
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
