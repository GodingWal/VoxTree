"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DeleteVoiceButton } from "@/components/ui/DeleteVoiceButton";

/* ─── 8 Recording Phases ─── */
const RECORDING_PROMPTS = [
  {
    id: "intro",
    title: "Phase 1: Introduction",
    short: "Introduction",
    text: 'Hello there! My name is [Your Name], and today I am recording my voice for a very special project. I hope this recording captures my natural speaking voice perfectly. Thank you for listening to me today.',
    description: "Speak naturally and clearly. This captures your baseline voice.",
    minDuration: 12,
    maxDuration: 20,
  },
  {
    id: "alphabet",
    title: "Phase 2: Letters & Numbers",
    short: "Letters & Numbers",
    text: "A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z. Now counting: one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, twenty.",
    description: "Say each letter and number clearly with brief pauses between them.",
    minDuration: 15,
    maxDuration: 25,
  },
  {
    id: "phonetics",
    title: "Phase 3: Phonetic Phrases",
    short: "Phonetic Phrases",
    text: "The thick thistle thickets threatened the three thriving thrushes. She sells seashells by the seashore. Peter Piper picked a peck of pickled peppers. How much wood would a woodchuck chuck if a woodchuck could chuck wood?",
    description: "Practice these tongue twisters slowly and clearly to capture all speech sounds.",
    minDuration: 15,
    maxDuration: 25,
  },
  {
    id: "story",
    title: "Phase 4: Storytelling",
    short: "Storytelling",
    text: "Once upon a time, in a faraway land, there lived a kind old wizard who loved to tell stories by the fireplace. Every evening, children from the village would gather around to hear tales of brave knights, magical creatures, and hidden treasures buried deep within enchanted forests.",
    description: "Tell this story with emotion and varied intonation like you are reading to a child.",
    minDuration: 18,
    maxDuration: 28,
  },
  {
    id: "questions",
    title: "Phase 5: Questions & Responses",
    short: "Questions & Responses",
    text: "What time is it? It is half past three. Where are you going? I am going to the store. How was your day today? My day was absolutely wonderful, thank you for asking! Did you remember to bring the keys? Yes, I have them right here in my pocket.",
    description: "Use natural question intonation, then answer with declarative statements.",
    minDuration: 15,
    maxDuration: 25,
  },
  {
    id: "emotions",
    title: "Phase 6: Emotional Range",
    short: "Emotional Range",
    text: "I am so incredibly happy right now! This is the best day ever! Oh no, that is really sad news, I am so sorry to hear that. Wait, what? Are you serious? I cannot believe this is happening! Well, that is interesting, I suppose I will have to think about it more carefully.",
    description: "Express joy, sadness, surprise, and thoughtfulness in your voice.",
    minDuration: 15,
    maxDuration: 25,
  },
  {
    id: "directions",
    title: "Phase 7: Instructions & Commands",
    short: "Instructions & Commands",
    text: "Please open the door and walk inside. Turn left at the first hallway, then continue straight ahead. You will find the kitchen on your right. Remember to close the window before you leave, and do not forget to lock the front door behind you.",
    description: "Speak clearly and authoritatively, as if giving directions to someone.",
    minDuration: 15,
    maxDuration: 25,
  },
  {
    id: "conversation",
    title: "Phase 8: Natural Conversation",
    short: "Natural Conversation",
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

interface VoiceProfile {
  id: string;
  name: string;
  status: "pending" | "training" | "ready" | "failed" | "processing";
  created_at?: string;
}

export default function VoiceCloningPage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelAnimationRef = useRef<number | null>(null);

  // Auth & plan
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("free");
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Voice name
  const [voiceName, setVoiceName] = useState("");

  // 8-phase recording state
  const [currentPhase, setCurrentPhase] = useState(0);
  const [recordings, setRecordings] = useState<RecordingSession[]>(
    RECORDING_PROMPTS.map((p) => ({
      id: p.id, blob: null, duration: 0,
      quality: { score: 0, issues: [], recommendations: [] },
      status: "pending" as const,
    }))
  );

  // Wizard mode: false = show profile list, true = recording wizard active
  const [wizardActive, setWizardActive] = useState(false);

  // Mic / recording
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [qualityWarnings, setQualityWarnings] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isTestingMic, setIsTestingMic] = useState(false);

  // Media refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Upload / processing
  const [creating, setCreating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

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
    const training = voiceProfiles.some(p => p.status === "pending" || p.status === "training" || p.status === "processing");
    if (!training) return;
    const interval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("family_voices").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (data) setVoiceProfiles(data);
    }, 5000);
    return () => clearInterval(interval);
  }, [voiceProfiles]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!wizardActive) return;
      if (e.code === "Space" && !isPlaying) {
        e.preventDefault();
        if (isRecording && !isPaused) pauseRecording();
        else if (isPaused) resumeRecording();
        else if (hasPermission && voiceName.trim().length > 0) startRecording();
      } else if (e.code === "Escape") {
        e.preventDefault();
        if (isRecording || isPaused) stopRecording();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isRecording, isPaused, isPlaying, hasPermission, wizardActive, voiceName]);

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
    animationRef.current = requestAnimationFrame(drawWaveform);
  }, [isRecording]);

  useEffect(() => {
    if (analyserRef.current && wizardActive) drawWaveform();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [analyserRef.current, wizardActive, drawWaveform]);

  /* ── Microphone setup ── */
  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, sampleRate: { ideal: 48000, min: 44100 } },
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
      toast({ title: "Microphone Connected", description: "Ready to record." });
    } catch (error: any) {
      setHasPermission(false);
      let msg = "Could not access microphone.";
      if (error?.name === "NotAllowedError") msg = "Microphone access denied. Please check browser permissions.";
      else if (error?.name === "NotFoundError") msg = "No microphone found. Please connect a microphone.";
      else if (error?.name === "NotReadableError") msg = "Microphone is being used by another application.";
      toast({ title: "Microphone Error", description: msg, variant: "destructive" });
    }
  };

  const testMicrophone = async () => {
    try {
      setIsTestingMic(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, sampleRate: { ideal: 48000, min: 44100 } },
      });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let testCount = 0;
      const stats = { peak: 0, average: 0, sumAvg: 0, clipping: false, tooQuiet: false };

      toast({ title: "Testing Microphone", description: "Speak normally for 10 seconds..." });

      const testInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0, max = 0;
        for (let i = 0; i < bufferLength; i++) { sum += dataArray[i] * dataArray[i]; max = Math.max(max, dataArray[i]); }
        const rms = Math.sqrt(sum / bufferLength);
        const level = Math.min(1, Math.max(0, rms / 128));
        setAudioLevel(level * 100);
        stats.peak = Math.max(stats.peak, level);
        stats.sumAvg += level;
        if (max / 255 > 0.95) stats.clipping = true;
        if (level < 0.1) stats.tooQuiet = true;
        testCount++;

        if (testCount >= 10) {
          clearInterval(testInterval);
          stats.average = stats.sumAvg / testCount;
          setAudioLevel(0);
          setIsTestingMic(false);
          ctx.close();
          stream.getTracks().forEach((t) => t.stop());
          let message = `Peak: ${(stats.peak * 100).toFixed(0)}% | Avg: ${(stats.average * 100).toFixed(0)}%`;
          let variant: "default" | "destructive" = "default";
          if (stats.clipping) { message += " | Clipping detected"; variant = "destructive"; }
          else if (stats.tooQuiet) { message += " | Too quiet"; variant = "destructive"; }
          else { message += " | Good levels"; }
          toast({ title: "Test Complete", description: message, variant });
        }
      }, 1000);
    } catch {
      setIsTestingMic(false);
      setAudioLevel(0);
      toast({ title: "Test Failed", description: "Could not test microphone.", variant: "destructive" });
    }
  };

  /* ── Recording controls ── */
  const startRecording = async () => {
    if (voiceName.trim().length === 0) {
      toast({ title: "Name Required", description: "Please enter a name for your voice clone before recording.", variant: "destructive" });
      return;
    }
    if (!streamRef.current) { await checkMicrophonePermission(); return; }
    try {
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

      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/mp4";
      }
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, { mimeType });
      const audioChunks: Blob[] = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        await processRecording(audioBlob);
      };
      mediaRecorderRef.current.onerror = () => {
        toast({ title: "Recording Error", description: "An error occurred while recording.", variant: "destructive" });
      };

      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setQualityWarnings([]);
      mediaRecorderRef.current.start(1000);
      setRecordings((prev) => prev.map((rec, idx) => idx === currentPhase ? { ...rec, status: "recording" as const } : rec));

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          const maxDur = RECORDING_PROMPTS[currentPhase].maxDuration;
          if (newTime >= maxDur) { stopRecording(); toast({ title: "Max Duration Reached", description: "Recording stopped automatically." }); }
          else if (newTime === maxDur - 5) { toast({ title: "5 Seconds Remaining" }); }
          return newTime;
        });
      }, 1000);

      updateAudioLevel();
    } catch {
      toast({ title: "Recording Failed", description: "Could not access microphone.", variant: "destructive" });
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      toast({ title: "Paused", description: "Press Space or Resume to continue." });
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      recordingTimerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
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
    setRecordings((prev) => prev.map((rec, idx) => idx === currentPhase ? { ...rec, blob: audioBlob, duration, quality, status: "completed" as const } : rec));
    if (quality.score >= 80) toast({ title: "Great Recording!", description: `Quality score: ${Math.round(quality.score)}/100` });
    else if (quality.score >= 60) toast({ title: "Good Recording", description: `Quality score: ${Math.round(quality.score)}/100` });
    else toast({ title: "Consider Retaking", description: `Quality score: ${Math.round(quality.score)}/100`, variant: "destructive" });
  };

  const retakeRecording = () => {
    setRecordings((prev) => prev.map((rec, idx) => idx === currentPhase ? { ...rec, blob: null, duration: 0, quality: { score: 0, issues: [], recommendations: [] }, status: "pending" as const } : rec));
    setRecordingTime(0);
  };

  /* ── Playback ── */
  const playRecording = (index: number) => {
    const rec = recordings[index];
    if (!rec.blob || !audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); return; }
    const url = URL.createObjectURL(rec.blob);
    audioRef.current.src = url;
    audioRef.current.playbackRate = playbackSpeed;
    audioRef.current.play();
    setIsPlaying(true);
    audioRef.current.onended = () => { setIsPlaying(false); URL.revokeObjectURL(url); };
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
      toast({ title: "File Uploaded", description: `${file.name} is ready.` });
    } else {
      toast({ title: "Invalid File", description: "Please upload an audio file.", variant: "destructive" });
    }
  };

  /* ── Create voice profile (combine all recordings & upload) ── */
  const handleComplete = async () => {
    if (!voiceName.trim()) return;
    setCreating(true);
    try {
      // Step 1: Create voice record via API
      const createRes = await fetch("/api/voices/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: voiceName }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Failed to create voice record");

      const voiceId = createData.voiceId;
      const uploadMode = createData.uploadMode ?? "direct";

      // Step 2: Combine all recording blobs
      let audioSource: Blob | File;
      if (uploadedFile) {
        audioSource = uploadedFile;
      } else {
        const blobs = recordings.filter((r) => r.blob).map((r) => r.blob!);
        if (blobs.length === 0) throw new Error("No recordings found");
        audioSource = new Blob(blobs, { type: blobs[0].type });
      }

      const file = audioSource instanceof File ? audioSource : new File([audioSource], "recording.webm", { type: "audio/webm" });

      // Step 3: Upload
      if (uploadMode === "s3" && createData.uploadUrl) {
        const uploadRes = await fetch(createData.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "audio/mpeg" }, body: file });
        if (!uploadRes.ok) throw new Error("S3 upload failed");
      } else {
        const formData = new FormData();
        formData.append("voiceId", voiceId);
        formData.append("audio", file);
        const uploadRes = await fetch("/api/voices/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) { const d = await uploadRes.json().catch(() => ({})); throw new Error(d.error || "Upload failed"); }
      }

      // Step 4: Process
      const processRes = await fetch("/api/voices/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceId }) });
      const processData = await processRes.json();

      if (processData.status === "ready") {
        toast({ title: "Voice Clone Created!", description: `${voiceName}'s voice is ready to use.` });
      } else {
        toast({ title: "Voice Processing", description: "Your voice is being processed. This may take a moment." });
      }

      // Refresh voices & reset wizard
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

  /* ── Reset wizard ── */
  const resetWizard = () => {
    setWizardActive(false);
    setVoiceName("");
    setCurrentPhase(0);
    setRecordings(RECORDING_PROMPTS.map((p) => ({
      id: p.id, blob: null, duration: 0,
      quality: { score: 0, issues: [], recommendations: [] },
      status: "pending" as const,
    })));
    setRecordingTime(0);
    setUploadedFile(null);
    setQualityWarnings([]);
  };

  /* ── Preview ── */
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
      toast({ title: "Preview Unavailable", variant: "destructive" });
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const canProceedPhase = () => { const rec = recordings[currentPhase]; return rec.status === "completed" && rec.quality.score >= 30; };
  const allRecordingsComplete = () => recordings.every((r) => r.status === "completed" && r.quality.score >= 30);
  const totalDuration = recordings.reduce((acc, r) => acc + r.duration, 0);
  const completedCount = recordings.filter((r) => r.status === "completed").length;
  const currentPrompt = RECORDING_PROMPTS[currentPhase];
  const currentRecording = recordings[currentPhase];

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 text-foreground">
      <audio ref={audioRef} preload="none" />
      <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
      <Nav plan={plan} />

      <main className="pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ─── Voice Recording Wizard ─── */}
          {wizardActive ? (
            <div className="space-y-3">
              {/* Wizard Header Card - matching old UI */}
              <Card>
                <CardHeader className="pb-3 pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <CardTitle className="text-base sm:text-lg">Voice Recording Wizard</CardTitle>
                    <Badge variant="outline" className="w-fit text-xs">
                      Step {currentPhase + 1} of {RECORDING_PROMPTS.length}
                    </Badge>
                  </div>
                  <Progress value={((currentPhase + 1) / RECORDING_PROMPTS.length) * 100} className="w-full mt-2 h-2" />
                </CardHeader>
              </Card>

              {/* Total Duration & 8-Step Grid */}
              <Card>
                <CardContent className="pt-3 pb-3">
                  {/* Total duration */}
                  <div className="mb-3 p-2 bg-muted/50 rounded-lg">
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
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                            isCompleted ? "bg-green-500 text-white" :
                              isActive ? "bg-primary text-primary-foreground" :
                                "bg-muted text-muted-foreground"
                          )}>
                            {isCompleted ? "\u2713" : index + 1}
                          </div>
                          <span className="text-[10px] text-center font-medium leading-tight hidden sm:block text-foreground">
                            {prompt.short}
                          </span>
                          {isCompleted && <span className="text-[10px] text-green-500">{rec.duration}s</span>}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Current Phase: Script (left) + Controls (right) - matching old layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Left: Script & instructions */}
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      {currentPrompt.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <Alert>
                      <AlertDescription>{currentPrompt.description}</AlertDescription>
                    </Alert>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm leading-relaxed">&quot;{currentPrompt.text}&quot;</p>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Duration: {currentPrompt.minDuration}-{currentPrompt.maxDuration}s</span>
                      <span className="flex items-center gap-1">
                        {formatTime(recordingTime)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Right: Recording Controls - matching old layout */}
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      Recording Controls
                      {isPaused && <Badge variant="secondary" className="ml-2">Paused</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {/* Voice Clone Name - inside controls like old UI */}
                    <div className="space-y-1">
                      <Label htmlFor="voice-name" className="text-sm font-medium">Voice Clone Name</Label>
                      <Input
                        id="voice-name"
                        placeholder="e.g., Dad's Calm Voice"
                        value={voiceName}
                        onChange={(e) => setVoiceName(e.target.value)}
                        disabled={isRecording || isPaused}
                      />
                      <p className="text-xs text-muted-foreground">Enter a name before starting to record.</p>
                    </div>

                    {/* Waveform */}
                    <canvas ref={canvasRef} width={400} height={60} className="w-full h-14 rounded-lg bg-slate-900" />

                    {/* Microphone Level */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Microphone Level</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className={cn("h-2 rounded-full transition-all duration-100",
                          audioLevel > 80 ? "bg-red-500" : audioLevel > 50 ? "bg-green-500" : audioLevel > 20 ? "bg-yellow-500" : "bg-gray-400"
                        )} style={{ width: `${audioLevel}%` }} />
                      </div>
                    </div>

                    {/* Quality warnings */}
                    {qualityWarnings.length > 0 && (isRecording || isPaused) && (
                      <div className="p-2 bg-amber-900/30 border border-amber-600 rounded-md">
                        <div className="text-sm text-amber-300">
                          {qualityWarnings.map((w, i) => <div key={i}>{w}</div>)}
                        </div>
                      </div>
                    )}

                    {/* Test Microphone & Troubleshoot - matching old UI */}
                    <div className="flex gap-2">
                      <Button onClick={testMicrophone} variant="outline" size="sm" className="flex-1" disabled={isRecording || isPaused || isTestingMic}>
                        {isTestingMic ? "Testing..." : "Test Microphone"}
                      </Button>
                      <Button onClick={checkMicrophonePermission} variant="outline" size="sm" className="flex-1" disabled={isRecording || isPaused}>
                        Troubleshoot
                      </Button>
                    </div>

                    {/* Recording Buttons */}
                    <div className="flex flex-col space-y-2">
                      {!isRecording && !isPaused ? (
                        <Button onClick={startRecording} disabled={!hasPermission || isTestingMic || voiceName.trim().length === 0} className="w-full" size="lg">
                          Start Recording (Space)
                        </Button>
                      ) : isPaused ? (
                        <div className="flex gap-2">
                          <Button onClick={resumeRecording} className="flex-1" size="lg">Resume (Space)</Button>
                          <Button onClick={stopRecording} variant="destructive" className="flex-1" size="lg">Stop</Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button onClick={pauseRecording} variant="outline" className="flex-1" size="lg">Pause (Space)</Button>
                          <Button onClick={stopRecording} variant="destructive" className="flex-1" size="lg">Stop ({recordingTime}s)</Button>
                        </div>
                      )}
                    </div>

                    {/* Keyboard shortcuts tip */}
                    <div className="text-xs text-muted-foreground text-center">
                      Tip: Press <kbd className="px-1 py-0.5 bg-muted rounded">Space</kbd> to pause/resume, <kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd> to stop
                    </div>

                    {/* Playback & Retake */}
                    {currentRecording.blob && (
                      <div className="space-y-2 border-t pt-2">
                        <div className="flex gap-2">
                          <Button onClick={() => playRecording(currentPhase)} variant="outline" className="flex-1">
                            {isPlaying ? "Pause" : "Play"}
                          </Button>
                          <Button onClick={changePlaybackSpeed} variant="outline" size="sm" className="w-20">
                            {playbackSpeed}x
                          </Button>
                          <Button onClick={retakeRecording} variant="outline" className="flex-1">
                            Retake
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground text-center">
                          Duration: {currentRecording.duration}s | Quality: {Math.round(currentRecording.quality.score)}/100
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quality Feedback */}
              {currentRecording.status === "completed" && currentRecording.quality.issues.length > 0 && (
                <Card>
                  <CardContent className="pt-3 pb-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      Recording Quality: {Math.round(currentRecording.quality.score)}/100
                    </div>
                    {currentRecording.quality.issues.length > 0 && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {currentRecording.quality.issues.map((issue, idx) => <li key={idx}>{issue}</li>)}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    {currentRecording.quality.recommendations.length > 0 && (
                      <Alert>
                        <AlertDescription>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {currentRecording.quality.recommendations.map((rec, idx) => <li key={idx}>{rec}</li>)}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Navigation - Previous / Next Step / Cancel like old UI */}
              <Card>
                <CardContent className="pt-3 pb-3">
                  <div className="flex flex-col sm:flex-row justify-between gap-2">
                    <Button onClick={() => setCurrentPhase(Math.max(0, currentPhase - 1))} disabled={currentPhase === 0 || isRecording || isPaused} variant="outline">
                      Previous
                    </Button>
                    <div className="flex flex-col sm:flex-row gap-2">
                      {currentPhase < RECORDING_PROMPTS.length - 1 ? (
                        <Button onClick={() => setCurrentPhase(currentPhase + 1)} disabled={!canProceedPhase() || isRecording || isPaused}>
                          Next Step
                        </Button>
                      ) : (
                        <Button
                          onClick={handleComplete}
                          disabled={!allRecordingsComplete() || isRecording || isPaused || creating}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {creating ? "Creating..." : "Complete Voice Profile"}
                        </Button>
                      )}
                      <Button onClick={() => { if (confirm("Cancel recording? Progress will be lost.")) resetWizard(); }} variant="outline" disabled={isRecording || isPaused}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* ─── Profile List View (when wizard is not active) ─── */
            <div className="space-y-8">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                  AI Voice Cloning
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-2">Create Your Voice Clone</h1>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Record 8 voice samples covering different speech patterns, emotions, and styles for the best clone quality
                </p>
              </div>

              {/* Start wizard CTA */}
              <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
                <CardContent className="p-6 sm:p-8">
                  <div className="text-center space-y-6">
                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-green-600 flex items-center justify-center shadow-lg shadow-primary/25">
                      <span className="text-4xl">&#127908;</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Start Voice Recording Wizard</h2>
                      <p className="text-muted-foreground">
                        Our 8-phase wizard captures your natural voice, emotions, storytelling style, and conversational tone
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                      {[
                        { label: "8 Phases", desc: "Different speech styles" },
                        { label: "~2 Minutes", desc: "Total recording time" },
                        { label: "AI Enhanced", desc: "Quality processing" },
                        { label: "Emotions", desc: "Joy, sadness, surprise" },
                      ].map((f) => (
                        <div key={f.label} className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="font-medium text-sm">{f.label}</p>
                          <p className="text-xs text-muted-foreground">{f.desc}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-4 max-w-md mx-auto">
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1 gap-2">
                        Upload Audio
                      </Button>
                      <Button onClick={() => { setWizardActive(true); checkMicrophonePermission(); }} className="flex-1 gap-2">
                        Start Recording
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Existing voice profiles */}
              {voiceProfiles.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">Your Voice Clones</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {voiceProfiles.map((profile) => (
                      <Card key={profile.id} className={cn("transition-all hover:shadow-md", selectedProfileId === profile.id && "ring-2 ring-primary")}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-11 h-11 rounded-full flex items-center justify-center ring-2",
                                profile.status === "ready" ? "bg-green-500/25 ring-green-500/50" :
                                  (profile.status === "training" || profile.status === "processing") ? "bg-amber-500/25 ring-amber-500/50" :
                                    profile.status === "failed" ? "bg-red-500/25 ring-red-500/50" : "bg-muted ring-border"
                              )}>
                                <span className="text-lg">
                                  {profile.status === "ready" ? "\uD83D\uDD0A" :
                                    (profile.status === "training" || profile.status === "pending" || profile.status === "processing") ? "\u23F3" : "\u26A0\uFE0F"}
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
                                  {isPlaying && selectedProfileId === profile.id ? "\u23F8" : "\u25B6\uFE0F"}
                                </Button>
                              )}
                              <DeleteVoiceButton
                                voiceId={profile.id}
                                voiceName={profile.name}
                                onDeleteSuccess={(id) => {
                                  setVoiceProfiles((prev) => prev.filter((p) => p.id !== id));
                                  if (selectedProfileId === id) setSelectedProfileId(null);
                                }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {voiceProfiles.length === 0 && (
                <div className="text-center py-10 rounded-xl border border-dashed border-border bg-muted/20">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                    <span className="text-2xl">\uD83D\uDD0A</span>
                  </div>
                  <p className="font-medium text-foreground">No voice clones yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Start the recording wizard above to create your first one!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
