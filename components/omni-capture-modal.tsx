"use client";

import React, { useState, useRef, useEffect } from "react";
import { Camera, Mic, RefreshCw, X, Loader2, Sparkles, Check, Lock, Play, Video } from "lucide-react";

interface OmniCaptureModalProps {
  voiceId: string;
  voiceName: string;
  onClose: () => void;
  onCaptureComplete: (avatarUrl: string, audioUrl: string) => void;
}

export function OmniCaptureModal({ voiceId, voiceName, onClose, onCaptureComplete }: OmniCaptureModalProps) {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordingStarted, setRecordingStarted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // States: permissions -> record -> submitting
  const [step, setStep] = useState<"permissions" | "record" | "submitting">("permissions");
  const [countdown, setCountdown] = useState(5);

  const startMediaStream = async () => {
    setError(null);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      // Combined hardware permission request, like Gemini Omni
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setStep("record");
    } catch (err: any) {
      console.error("Camera/Mic access error:", err);
      setError("Unable to access camera or microphone. Please verify permission settings.");
    }
  };

  const startRecording = () => {
    if (!stream) return;
    setError(null);
    chunksRef.current = [];
    setCountdown(5);
    setRecordingStarted(true);

    // Attempt standard webm video recording
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

      mediaRecorder.onstop = async () => {
        const completeBlob = new Blob(chunksRef.current, { type: "video/webm" });
        await uploadRecording(completeBlob);
      };

      mediaRecorder.start();
      setRecording(true);

      // Start 5-second countdown timer
      let timeLeft = 5;
      timerRef.current = setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);
        if (timeLeft <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          stopRecording();
        }
      }, 1000);

    } catch (err: any) {
      setError("Failed to initialize MediaRecorder: " + err.message);
      setRecordingStarted(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    setStep("submitting");
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const uploadRecording = async (blob: Blob) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", blob, "omni_recording.webm");
      formData.append("voiceName", voiceName);

      const response = await fetch(`/api/voices/${voiceId}/omni-upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to process Omni upload.");
      }

      onCaptureComplete(data.avatarUrl, data.audioUrl);
    } catch (err: any) {
      setError(err.message || "Failed to submit recording.");
      setStep("record");
      setRecordingStarted(false);
      // Restart camera so they can retry
      startMediaStream();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [stream]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "rgba(10, 14, 31, 0.9)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      {/* Inline styles for custom premium animations */}
      <style>{`
        @keyframes omni-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes omni-pulse {
          0%, 100% { transform: scale(1) translate(-50%, -50%); opacity: 0.7; }
          50% { transform: scale(1.04) translate(-48%, -48%); opacity: 1; }
        }
        .omni-glow-circle {
          transform-origin: center;
        }
      `}</style>

      <div
        style={{
          background: "var(--ink-2)",
          border: "1px solid var(--ink-3)",
          borderRadius: 24,
          maxWidth: 820,
          width: "100%",
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
        className="fadeUp"
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid var(--ink-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={18} style={{ color: "var(--lamp)" }} />
            <h3 className="serif" style={{ fontSize: 20, color: "var(--paper)", margin: 0 }}>Activate Your Clone</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: 0, color: "var(--paper-dim)", cursor: "pointer" }} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        {/* Body content splitting layout */}
        <div className="flex flex-col md:flex-row gap-0">
          
          {/* Left Viewport (Webcam Screen) */}
          <div style={{ flex: 1.2, position: "relative", aspectRatio: "4/3", background: "#060919", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
            />
            
            {/* Premium Pulsing Gradient Face Tracker Frame */}
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
              <defs>
                <linearGradient id="omni-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--lamp)" />
                  <stop offset="50%" stopColor="#e0533c" />
                  <stop offset="100%" stopColor="#3ca374" />
                </linearGradient>
              </defs>
              
              {/* Soft outer glow */}
              <circle 
                cx="50%" 
                cy="50%" 
                r="32%" 
                stroke="var(--lamp)" 
                strokeWidth="10" 
                fill="none" 
                opacity="0.08"
                style={{ filter: "blur(6px)" }}
              />

              {/* Pulsing & spinning gradient dash tracker */}
              <circle 
                cx="50%" 
                cy="50%" 
                r="32%" 
                stroke="url(#omni-grad)" 
                strokeWidth="3.5" 
                fill="none" 
                strokeDasharray="12 8"
                className="omni-glow-circle"
                style={{
                  transformOrigin: "center",
                  animation: recording 
                    ? "omni-spin 12s linear infinite, omni-pulse 2s ease-in-out infinite" 
                    : "omni-spin 25s linear infinite"
                }}
              />
            </svg>

            {/* Step: permissions overlay */}
            {step === "permissions" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(6, 9, 25, 0.92)", padding: 24 }}>
                <div style={{ textAlign: "center", maxWidth: 280 }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(244, 184, 96, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <Video size={28} style={{ color: "var(--lamp)" }} />
                  </div>
                  <p style={{ color: "var(--paper)", fontSize: 16, fontWeight: 600, margin: "0 0 8px 0" }}>Camera & Microphone Access</p>
                  <p style={{ color: "var(--paper-dim)", fontSize: 13, lineHeight: 1.4, margin: 0 }}>
                    We request combined hardware permissions to capture the video frame and audio sample simultaneously.
                  </p>
                </div>
              </div>
            )}

            {/* Step: submitting overlay */}
            {step === "submitting" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(6, 9, 25, 0.88)", gap: 16 }}>
                <Loader2 size={36} className="animate-spin" style={{ color: "var(--lamp)" }} />
                <span className="mono" style={{ color: "var(--paper)", fontSize: 12, letterSpacing: "0.15em" }}>PROCESSING STREAM & BINDING CLONE...</span>
              </div>
            )}

            {/* Recording badge */}
            {recording && (
              <div style={{
                position: "absolute",
                top: 20,
                right: 20,
                background: "rgba(224, 83, 60, 0.85)",
                color: "white",
                padding: "6px 14px",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: 8,
                backdropFilter: "blur(4px)",
                border: "1px solid rgba(255, 255, 255, 0.2)"
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "white", display: "inline-block" }} className="animate-pulse" />
                LIVE CAPTURE • {countdown}s
              </div>
            )}
          </div>

          {/* Right Panel (Prompts & Interactive Step List) */}
          <div style={{ padding: 28, display: "flex", flexDirection: "column", justifyContent: "space-between", background: "var(--ink-2.5, #11152a)", borderLeft: "1px solid var(--ink-3)" }} className="w-full md:w-[360px]">
            <div>
              <h4 className="serif" style={{ fontSize: 18, color: "var(--paper)", margin: "0 0 16px 0" }}>Onboarding Tracker</h4>
              
              {/* Step-by-Step Interactive Hook List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 }}>
                
                {/* Step 1: Permissions */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: step !== "permissions" ? "rgba(127, 196, 164, 0.15)" : "var(--lamp)",
                    color: step !== "permissions" ? "#7fc4a4" : "var(--ink-0)",
                    fontSize: 12, fontWeight: "bold", flexShrink: 0
                  }}>
                    {step !== "permissions" ? <Check size={13} /> : "1"}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: step !== "permissions" ? "var(--paper-dim)" : "var(--paper)" }}>
                      Hardware Access
                    </div>
                    <div style={{ fontSize: 11.5, color: "rgba(244, 236, 219, 0.45)" }}>
                      {step !== "permissions" ? "Camera and mic connected" : "Combined system permissions"}
                    </div>
                  </div>
                </div>

                {/* Step 2: Alignment */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: step === "permissions" ? "rgba(255,255,255,0.03)" : (recordingStarted || step === "submitting" ? "rgba(127, 196, 164, 0.15)" : "var(--lamp)"),
                    color: step === "permissions" ? "rgba(255,255,255,0.2)" : (recordingStarted || step === "submitting" ? "#7fc4a4" : "var(--ink-0)"),
                    fontSize: 12, fontWeight: "bold", flexShrink: 0
                  }}>
                    {recordingStarted || step === "submitting" ? <Check size={13} /> : step === "permissions" ? <Lock size={11} /> : "2"}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: step === "permissions" ? "rgba(255,255,255,0.2)" : (recordingStarted || step === "submitting" ? "var(--paper-dim)" : "var(--paper)") }}>
                      Webcam Framing
                    </div>
                    <div style={{ fontSize: 11.5, color: "rgba(244, 236, 219, 0.45)" }}>
                      {step === "permissions" ? "Locked" : (recordingStarted || step === "submitting" ? "Frame confirmed" : "Center face in the circle")}
                    </div>
                  </div>
                </div>

                {/* Step 3: Recording & Teleprompter */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: !recordingStarted ? "rgba(255,255,255,0.03)" : (step === "submitting" ? "rgba(127, 196, 164, 0.15)" : "var(--lamp)"),
                    color: !recordingStarted ? "rgba(255,255,255,0.2)" : (step === "submitting" ? "#7fc4a4" : "var(--ink-0)"),
                    fontSize: 12, fontWeight: "bold", flexShrink: 0
                  }}>
                    {step === "submitting" ? <Check size={13} /> : !recordingStarted ? <Lock size={11} /> : "3"}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: !recordingStarted ? "rgba(255,255,255,0.2)" : (step === "submitting" ? "var(--paper-dim)" : "var(--paper)") }}>
                      Multi-Modal Record
                    </div>
                    <div style={{ fontSize: 11.5, color: "rgba(244, 236, 219, 0.45)" }}>
                      {!recordingStarted ? "Locked" : (step === "submitting" ? "Unified media captured" : `Record: ${countdown}s left`)}
                    </div>
                  </div>
                </div>

                {/* Step 4: AI Stream Split */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: step !== "submitting" ? "rgba(255,255,255,0.03)" : "var(--lamp)",
                    color: step !== "submitting" ? "rgba(255,255,255,0.2)" : "var(--ink-0)",
                    fontSize: 12, fontWeight: "bold", flexShrink: 0
                  }}>
                    {step !== "submitting" ? <Lock size={11} /> : "4"}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: step !== "submitting" ? "rgba(255,255,255,0.2)" : "var(--paper)" }}>
                      Secure Binding
                    </div>
                    <div style={{ fontSize: 11.5, color: "rgba(244, 236, 219, 0.45)" }}>
                      {step !== "submitting" ? "Locked" : "Splitting audio/video streams"}
                    </div>
                  </div>
                </div>

              </div>

              {/* Teleprompter Script */}
              {step === "record" && (
                <div style={{
                  background: recording ? "rgba(244, 184, 96, 0.06)" : "rgba(255, 255, 255, 0.02)",
                  border: recording ? "1px solid rgba(244, 184, 96, 0.25)" : "1px solid var(--ink-3)",
                  borderRadius: 16,
                  padding: 16,
                  transition: "all 0.3s ease",
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: 10, color: "var(--paper-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontWeight: 600 }}>
                    {recording ? "🔴 SPEAK NOW (Script)" : "TELEPROMPTER"}
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: 14.5,
                    color: recording ? "var(--lamp)" : "var(--paper)",
                    lineHeight: 1.5,
                    fontWeight: 500,
                    fontStyle: recording ? "normal" : "italic"
                  }}>
                    &ldquo;Welcome to VoxTree. Let&apos;s build a timeline of stories together.&rdquo;
                  </p>
                  {recording && (
                    <div style={{ fontSize: 11, color: "rgba(244, 236, 219, 0.5)", marginTop: 10, lineHeight: 1.3 }}>
                      💡 Action: Look at the camera, blink, and turn your head slightly left and right.
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div style={{ color: "var(--rose)", fontSize: 12, margin: "12px 0", lineHeight: 1.4 }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: "auto", paddingTop: 16 }}>
              {step === "permissions" ? (
                <button
                  onClick={startMediaStream}
                  style={{
                    flex: 1,
                    padding: "14px",
                    background: "var(--lamp)",
                    color: "var(--ink-0)",
                    border: "none",
                    borderRadius: 16,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                  }}
                >
                  <Video size={16} /> Enable Permissions
                </button>
              ) : step === "record" && !recordingStarted ? (
                <button
                  onClick={startRecording}
                  style={{
                    flex: 1,
                    padding: "14px",
                    background: "var(--lamp)",
                    color: "var(--ink-0)",
                    border: "none",
                    borderRadius: 16,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                  }}
                >
                  <Play size={16} /> Start 5s Capture
                </button>
              ) : step === "record" && recording ? (
                <button
                  onClick={stopRecording}
                  style={{
                    flex: 1,
                    padding: "14px",
                    background: "var(--rose)",
                    color: "white",
                    border: "none",
                    borderRadius: 16,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                  }}
                >
                  <Loader2 size={16} className="animate-spin" /> Finish & Submit
                </button>
              ) : (
                <button
                  disabled
                  style={{
                    flex: 1,
                    padding: "14px",
                    background: "var(--ink-3)",
                    color: "var(--paper-dim)",
                    border: "none",
                    borderRadius: 16,
                    fontWeight: 600,
                    fontSize: 14,
                    opacity: 0.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                  }}
                >
                  <Loader2 size={16} className="animate-spin" /> Processing...
                </button>
              )}
              <button
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: "14px 20px",
                  background: "transparent",
                  color: "var(--paper-dim)",
                  border: "1px solid var(--ink-3)",
                  borderRadius: 16,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
