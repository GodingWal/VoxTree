"use client";
 
import React, { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X, Camera, RotateCcw, Check, AlertCircle, Video, Mic } from "lucide-react";
import Image from "next/image";

interface Props {
  voiceId: string;
  voiceName: string;
  initialReferences?: string[];
  initialStatus?: "not_started" | "training" | "ready" | "failed" | string | null;
  initialTriggerWord?: string | null;
  onReady?: (triggerWord: string) => void;
}

interface ScanStep {
  label: string;
  instruction: string;
  description: string;
}

const SCAN_STEPS: ScanStep[] = [
  { label: "Front Center", instruction: "Look straight at the camera", description: "Position your face in the center of the frame." },
  { label: "Turn Left", instruction: "Turn your head slightly left", description: "Show the right side of your profile." },
  { label: "Turn Right", instruction: "Turn your head slightly right", description: "Show the left side of your profile." },
  { label: "Look Up", instruction: "Tilt your head slightly up", description: "Tilt your chin up to capture the lower angle." },
  { label: "Look Down", instruction: "Tilt your head slightly down", description: "Tilt your chin down to capture the forehead angle." },
  { label: "Smile", instruction: "Give a big warm smile!", description: "Let's capture your smiling expression." },
  { label: "Playful / Smirk", instruction: "Give a playful wink or smirk!", description: "Show some character!" },
  { label: "Surprised", instruction: "Look surprised!", description: "Open your eyes and mouth wide." },
];

const TELEPROMPTER_SCRIPT = `Welcome to VoxTree! Let's build a timeline of family stories together.

By recording this script, I am creating a secure digital clone of my voice and visual features. This clone will be used to narrate bedtime stories, share history, and preserve family memories for my children and loved ones.

As I speak, the engine is capturing the unique warmth, tone, and cadence of my voice. I will continue reading this text naturally to provide enough voice data for high-fidelity generation, allowing my family to share in these moments forever.`;

export function LoraReferencesUploader({
  voiceId,
  voiceName,
  initialReferences = [],
  initialStatus,
  initialTriggerWord,
  onReady,
}: Props) {
  const [existing] = useState<string[]>(initialReferences);
  const [extras, setExtras] = useState<(File | null)[]>(Array(8).fill(null));
  const [previews, setPreviews] = useState<string[]>([]);
  const [status, setStatus] = useState<string>(initialStatus ?? "not_started");
  const [trigger, setTrigger] = useState<string | null>(initialTriggerWord ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState("");

  // Scanner & Video States
  const [scannerState, setScannerState] = useState<"idle" | "requesting" | "active" | "review">("idle");
  const [recordingMs, setRecordingMs] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const snappedStepsRef = useRef<Set<number>>(new Set());

  // Generate object-URL previews for the staged files; revoke on change.
  useEffect(() => {
    const urls = extras.map((f) => (f ? URL.createObjectURL(f) : ""));
    setPreviews(urls);
    return () => urls.forEach((u) => { if (u) URL.revokeObjectURL(u); });
  }, [extras]);

  // Clean up streams & URLs on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [stream, videoUrl]);

  // Poll training status while it's in flight
  useEffect(() => {
    if (status !== "training") return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/avatar/train/status?voiceId=${voiceId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "ready") {
          setStatus("ready");
          if (data.triggerWord) setTrigger(data.triggerWord);
          if (onReady && data.triggerWord) onReady(data.triggerWord);
        } else if (data.status === "failed") {
          setStatus("failed");
          setError("Training failed. Try again with clearer reference photos.");
        }
      } catch {}
    };

    const interval = setInterval(tick, 6000);
    tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status, voiceId, onReady]);

  const startScan = async () => {
    setExtras(Array(8).fill(null));
    setVideoBlob(null);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    setError(null);
    setScannerState("requesting");
    setRecordingMs(0);
    snappedStepsRef.current.clear();

    try {
      // Request combined camera and microphone permissions
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: true,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setScannerState("active");
    } catch (err) {
      console.error("Camera/Mic access error:", err);
      setError("Unable to access camera or microphone. Please verify permission settings and try again.");
      setScannerState("idle");
    }
  };

  const startRecording = () => {
    if (!stream) return;
    setError(null);
    chunksRef.current = [];
    setRecordingMs(0);
    snappedStepsRef.current.clear();
    setRecording(true);

    let options = { mimeType: "video/webm;codecs=vp9,opus" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/webm" };
    }

    try {
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const completeBlob = new Blob(chunksRef.current, { type: "video/webm" });
        setVideoBlob(completeBlob);
        setVideoUrl(URL.createObjectURL(completeBlob));
        setScannerState("review");
      };

      mediaRecorder.start();

      let ms = 0;
      timerIntervalRef.current = setInterval(() => {
        ms += 100;
        setRecordingMs(ms);

        const currentSecond = ms / 1000;
        
        // Auto snapshot at specific timestamps: 1.5s, 4.5s, 7.5s, 10.5s, 13.5s, 16.5s, 19.5s, 22.5s
        SCAN_STEPS.forEach((step, index) => {
          const snapTime = index * 3 + 1.5;
          if (currentSecond >= snapTime && !snappedStepsRef.current.has(index)) {
            snappedStepsRef.current.add(index);
            captureFrameForStep(index);
          }
        });

        // 45 seconds total duration
        if (ms >= 45000) {
          stopRecording();
        }
      }, 100);

    } catch (err: any) {
      setError("Failed to initialize MediaRecorder: " + err.message);
      setRecording(false);
    }
  };

  const captureFrameForStep = (stepIndex: number) => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    try {
      // Crop to a square centered frame
      const size = Math.min(video.videoWidth, video.videoHeight) || 480;
      canvas.width = size;
      canvas.height = size;

      const sx = (video.videoWidth - size) / 2 || 0;
      const sy = (video.videoHeight - size) / 2 || 0;

      // Draw normal unmirrored frame to canvas (best for training)
      context.drawImage(video, sx, sy, size, size, 0, 0, size, size);

      // Trigger visual shutter flash
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 150);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `scan_${stepIndex}.jpg`, { type: "image/jpeg" });
            setExtras((prev) => {
              const next = [...prev];
              next[stepIndex] = file;
              return next;
            });
          }
        },
        "image/jpeg",
        0.95
      );
    } catch (e) {
      console.error("Failed to capture frame:", e);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    stopCameraStream();
  };

  const stopCameraStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
  };

  const cancelScan = () => {
    stopRecording();
    stopCameraStream();
    setExtras(Array(8).fill(null));
    setVideoBlob(null);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    setScannerState("idle");
  };

  const redoScan = () => {
    cancelScan();
    startScan();
  };

  const submit = async () => {
    const actualImages = extras.filter((f): f is File => f !== null);
    if (actualImages.length < SCAN_STEPS.length) {
      setError(`Scan completed with only ${actualImages.length} images. Please redo the scan.`);
      return;
    }
    if (!videoBlob) {
      setError("WebM video recording is missing. Please redo the scan.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Upload WebM to voice omni-upload
      setSubmitStep("Processing video & cloning voice...");
      const omniFormData = new FormData();
      omniFormData.append("file", videoBlob, "omni_recording.webm");
      omniFormData.append("voiceName", voiceName);

      const omniRes = await fetch(`/api/voices/${voiceId}/omni-upload`, {
        method: "POST",
        body: omniFormData,
      });
      const omniData = await omniRes.json();
      if (!omniRes.ok) throw new Error(omniData.error ?? "Failed to upload video recording.");

      // 2. Upload snaps to avatar/train
      setSubmitStep("Starting Pixar LoRA model training...");
      const trainFormData = new FormData();
      trainFormData.append("voiceId", voiceId);
      actualImages.forEach((file) => {
        trainFormData.append("images", file, file.name);
      });

      const trainRes = await fetch("/api/avatar/train", {
        method: "POST",
        body: trainFormData,
      });
      const trainData = await trainRes.json();
      if (!trainRes.ok) throw new Error(trainData.error ?? "Failed to start avatar LoRA training.");

      setStatus("training");
      if (trainData.triggerWord) setTrigger(trainData.triggerWord);
      setExtras(Array(8).fill(null));
      setVideoBlob(null);
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
      }
      setScannerState("idle");
    } catch (err: any) {
      setError(err?.message ?? "Could not submit capture data");
    } finally {
      setSubmitting(false);
      setSubmitStep("");
    }
  };

  const triggerRetrain = () => {
    setStatus("not_started");
    setScannerState("idle");
    setExtras(Array(8).fill(null));
    setError(null);
  };

  return (
    <div className="rounded-[2rem] border border-[var(--ink-3)] bg-[var(--ink-1)] p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[var(--lamp)]/10 to-transparent blur-3xl rounded-full pointer-events-none" />

      {/* CSS Animations */}
      <style>{`
        @keyframes scannerFlash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        .scanner-flash-overlay {
          position: absolute;
          inset: 0;
          background: white;
          animation: scannerFlash 0.15s ease-out forwards;
          pointer-events: none;
          z-index: 50;
        }
      `}</style>

      <div className="relative z-10 space-y-6">
        {/* Header Section */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[var(--lamp)]" />
              <span className="rounded-full bg-[var(--lamp)]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--lamp-soft)] border border-[var(--lamp)]/30">
                Identity LoRA
              </span>
            </div>
            <h3 className="font-serif text-3xl text-white">Guided Multi-Modal Scanner</h3>
            <p className="text-[var(--paper-dim)] leading-relaxed">
              We capture your visual expressions and voice details in a single continuous session. Follow the face angles, then read the script to train your Pixar character clone.
            </p>
          </div>

          <StatusBadge status={status} trigger={trigger} />
        </div>

        {/* Existing References (if any) */}
        {existing.length > 0 && status === "ready" && (
          <div>
            <div className="mono text-xs text-[var(--paper-mute)] uppercase tracking-wider mb-2">
              Current Reference Images ({existing.length})
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {existing.map((u, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-xl overflow-hidden border border-[var(--ink-3)] bg-[var(--ink-2)]"
                >
                  <Image src={u} alt={`reference ${i}`} fill unoptimized className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCANNER STATE: IDLE */}
        {status !== "training" && status !== "ready" && scannerState === "idle" && (
          <div className="rounded-2xl border border-[var(--ink-3)] bg-[var(--ink-2)]/40 p-8 flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-full bg-[var(--ink-2)] border border-[var(--ink-3)] flex items-center justify-center text-[var(--lamp)]">
              <Video className="h-8 w-8" />
            </div>
            <div className="space-y-2 max-w-md">
              <h4 className="serif text-xl text-white">Interactive Unified Scan</h4>
              <p className="text-sm text-[var(--paper-dim)] leading-relaxed">
                Connect your webcam and microphone to capture voice characteristics and facial angles in a single 45-second session.
              </p>
            </div>
            <button
              onClick={startScan}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold bg-[var(--lamp)] text-[var(--ink-0)] hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-lg shadow-[var(--lamp)]/10"
            >
              <Camera className="h-5 w-5" />
              Start Unified Scanner
            </button>
          </div>
        )}

        {/* SCANNER STATE: REQUESTING */}
        {scannerState === "requesting" && (
          <div className="rounded-2xl border border-[var(--ink-3)] bg-[var(--ink-2)]/40 p-16 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--lamp)]" />
            <span className="mono text-xs text-[var(--paper-dim)] tracking-widest uppercase">
              Initializing webcam & microphone...
            </span>
          </div>
        )}

        {/* SCANNER STATE: ACTIVE */}
        {scannerState === "active" && (
          <div className="flex flex-col items-center gap-6">
            
            {/* Webcam Frame Box (Full Size & Overlays) */}
            <div className="relative w-full max-w-2xl aspect-[4/3] rounded-3xl overflow-hidden border-4 border-[var(--ink-3)] bg-black shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {/* Shutter Flash Overlay */}
              {isFlashing && <div className="scanner-flash-overlay" />}

              {/* Total Progress Bar (Time tracking) */}
              {recording && (
                <div className="absolute top-0 inset-x-0 h-1.5 bg-white/20 z-20">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--lamp)] to-green-400 transition-all duration-100"
                    style={{ width: `${(recordingMs / 45000) * 100}%` }}
                  />
                </div>
              )}

              {/* Timer/Remaining Time Badge */}
              {recording && (
                <div className="absolute top-4 right-4 z-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-3 py-1 flex items-center gap-2 text-xs font-semibold text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span>{Math.max(0, 45 - Math.floor(recordingMs / 1000))}s left</span>
                </div>
              )}

              {/* Phase 1 Overlay: Face guide (0s to 24s) */}
              {recording && recordingMs < 24000 && (
                <>
                  {/* Silhouette */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 opacity-30">
                    <svg viewBox="0 0 100 100" className="w-[75%] h-[75%] text-[var(--lamp)]">
                      <circle cx="50" cy="35" r="17" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" />
                      <path d="M15,90 C15,64 30,54 50,54 C70,54 85,64 85,90" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" />
                    </svg>
                  </div>

                  {/* Translucent Step Guide Overlay */}
                  <div className="absolute inset-x-4 bottom-4 z-20 bg-black/75 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-center flex flex-col items-center justify-center gap-1 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <span className="rounded-full bg-[var(--lamp)]/10 px-3 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--lamp-soft)] border border-[var(--lamp)]/20">
                      Step {Math.floor(recordingMs / 3000) + 1} of 8 · {SCAN_STEPS[Math.floor(recordingMs / 3000)].label}
                    </span>
                    <h4 className="font-serif text-lg md:text-xl text-white font-medium">
                      {SCAN_STEPS[Math.floor(recordingMs / 3000)].instruction}
                    </h4>
                    <p className="text-xs text-[var(--paper-dim)]">
                      {SCAN_STEPS[Math.floor(recordingMs / 3000)].description}
                    </p>
                    {/* Progress indicator for step */}
                    <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-[var(--lamp)] transition-all duration-100"
                        style={{ width: `${((recordingMs % 3000) / 3000) * 100}%` }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Phase 2 Overlay: Voice check Teleprompter (24s to 45s) */}
              {recording && recordingMs >= 24000 && (
                <div className="absolute inset-x-4 bottom-4 top-4 z-20 bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col justify-between shadow-2xl animate-in fade-in duration-300">
                  <div className="text-center shrink-0">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Mic className="h-3.5 w-3.5 text-green-400 animate-pulse" />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-green-400">🎙️ Voice Capture active</span>
                    </div>
                    <h4 className="font-serif text-base text-white">Read the script out loud:</h4>
                  </div>
                  
                  <div className="flex-1 my-3 overflow-y-auto px-3 py-2 border border-white/5 bg-white/5 rounded-xl text-center flex items-center justify-center">
                    <p className="text-sm md:text-base text-white/95 leading-relaxed font-sans max-w-md select-none font-medium">
                      {TELEPROMPTER_SCRIPT}
                    </p>
                  </div>

                  <div className="text-center shrink-0 text-[10px] text-[var(--paper-dim)] font-mono">
                    Keep speaking naturally until the timer ends.
                  </div>
                </div>
              )}

              {/* PRE-RECORDING OVERLAY */}
              {!recording && (
                <div className="absolute inset-0 z-20 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-6">
                  <div className="bg-black/85 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center max-w-sm flex flex-col items-center gap-4 shadow-2xl">
                    <div className="w-12 h-12 rounded-full bg-[var(--lamp)]/10 text-[var(--lamp)] flex items-center justify-center border border-[var(--lamp)]/20 animate-pulse">
                      <Video className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-serif text-lg text-white">Unified Scanner Ready</h4>
                      <p className="text-xs text-[var(--paper-dim)] mt-1.5 leading-relaxed">
                        Position your face in the camera view. When ready, click Start Capture. You will guide your face through 8 expressions, then read the script.
                      </p>
                    </div>
                    <div className="flex gap-2.5 w-full mt-2">
                      <button
                        onClick={cancelScan}
                        className="flex-1 px-4 py-2.5 rounded-full text-xs font-semibold border border-white/10 text-white hover:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={startRecording}
                        className="flex-1 px-4 py-2.5 rounded-full text-xs font-bold bg-[var(--lamp)] text-[var(--ink-0)] hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--lamp)]/20"
                      >
                        Start Capture
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cancel Button during active capture */}
            {recording && (
              <button
                onClick={cancelScan}
                className="px-6 py-2.5 rounded-full text-xs font-semibold border border-[var(--ink-3)] text-[var(--paper-dim)] hover:text-white hover:bg-[var(--ink-3)]/30 transition-colors"
              >
                Cancel Recording
              </button>
            )}
          </div>
        )}

        {/* SCANNER STATE: REVIEW */}
        {scannerState === "review" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--moss)]/20 bg-[var(--moss)]/5 p-4 flex items-center gap-3">
              <Check className="h-5 w-5 text-[var(--moss)]" />
              <div className="text-sm text-[var(--paper-dim)]">
                Recording complete! Review your video clip and the 8 snapped reference photos.
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left: Video Playback */}
              <div className="space-y-3">
                <span className="mono text-xs text-[var(--paper-mute)] tracking-wider block uppercase">Recorded Clip (Video + Voice)</span>
                <video
                  src={videoUrl || undefined}
                  controls
                  className="w-full aspect-[4/3] rounded-2xl object-cover bg-black border border-[var(--ink-3)] shadow-lg"
                />
              </div>

              {/* Right: Snapped Reference Frames */}
              <div className="space-y-3">
                <span className="mono text-xs text-[var(--paper-mute)] tracking-wider block uppercase">Extracted Reference Frames (8 Angles)</span>
                <div className="grid grid-cols-4 gap-2.5">
                  {previews.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-[var(--ink-3)] bg-[var(--ink-2)] group shadow-md">
                      {url && (
                        <Image src={url} alt={SCAN_STEPS[i].label} fill unoptimized className="object-cover" />
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/85 py-1 text-center border-t border-white/5">
                        <span className="mono text-[8px] text-[var(--lamp-soft)] font-semibold uppercase tracking-wider block truncate px-1">
                          {SCAN_STEPS[i].label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Form submit/restart controls */}
            <div className="flex items-center justify-between gap-4 flex-wrap pt-4 border-t border-[var(--ink-3)]">
              <button
                onClick={redoScan}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-semibold border border-[var(--ink-3)] text-[var(--paper-dim)] hover:text-white hover:bg-[var(--ink-3)]/30 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
              >
                <RotateCcw className="h-4 w-4" />
                Redo Capture
              </button>

              <button
                onClick={submit}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold bg-[var(--lamp)] text-[var(--ink-0)] hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{submitStep || "Submitting..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Looks Good, Train Clone</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* READY STATE CONTROLS */}
        {status === "ready" && scannerState === "idle" && (
          <div className="pt-4 border-t border-[var(--ink-3)]">
            <button
              onClick={triggerRetrain}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold bg-[var(--ink-2)] text-[var(--paper-dim)] hover:text-white border border-[var(--ink-3)] transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retrain Identity Clone
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-4 py-3 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Polling / Submitting loader in general status */}
        {status === "training" && (
          <div className="rounded-2xl border border-[var(--lamp)]/20 bg-[var(--lamp)]/5 p-8 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--lamp)]" />
            <h4 className="serif text-lg text-white">Training Identity LoRA Model</h4>
            <p className="text-xs text-[var(--paper-dim)] max-w-sm">
              Replicate is training your Flux LoRA clone. This process takes 15–20 minutes. You can navigate away safely; the status updates automatically.
            </p>
          </div>
        )}
      </div>

      {/* Hidden offscreen canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

function StatusBadge({
  status,
  trigger,
}: {
  status: string;
  trigger: string | null;
}) {
  if (status === "ready") {
    return (
      <div className="rounded-2xl border border-[var(--moss)]/30 bg-[var(--moss)]/10 px-4 py-3 text-sm shrink-0">
        <div className="text-[var(--moss)] font-semibold uppercase tracking-wider text-xs">
          LoRA Ready
        </div>
        {trigger && (
          <div className="mono text-xs text-[var(--paper-dim)] mt-1">
            trigger: {trigger}
          </div>
        )}
      </div>
    );
  }
  if (status === "training") {
    return (
      <div className="rounded-2xl border border-[var(--lamp)]/30 bg-[var(--lamp)]/10 px-4 py-3 text-sm flex items-center gap-2 shrink-0">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--lamp)]" />
        <div className="text-[var(--lamp)] font-semibold uppercase tracking-wider text-xs">
          Training
        </div>
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 shrink-0">
        Training failed
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[var(--ink-3)] bg-[var(--ink-2)] px-4 py-3 text-xs text-[var(--paper-dim)] shrink-0">
      Not trained yet
    </div>
  );
}
