"use client";

import React, { useRef, useState, useEffect } from "react";
import { Camera, RefreshCw, Check, X, Loader2 } from "lucide-react";

interface VisualCloneCaptureProps {
  voiceId: string;
  onSuccess: (avatarUrl: string) => void;
  onClose: () => void;
}

export function VisualCloneCapture({ voiceId, onSuccess, onClose }: VisualCloneCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Start webcam stream
  const startCamera = async () => {
    setError(null);
    setCameraActive(false);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please verify permission settings.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [voiceId]);

  // Capture frame
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Use square resolution
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    // Center crop
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;

    context.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    
    // Save base64
    const dataUrl = canvas.toDataURL("image/png");
    setCapturedImage(dataUrl);

    // Stop camera track to release hardware resource
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setCameraActive(false);
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  // Upload image
  const uploadPhoto = async () => {
    if (!capturedImage) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/voices/${voiceId}/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: capturedImage }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to upload image.");
      }

      onSuccess(data.avatarUrl);
    } catch (err: any) {
      setError(err.message || "Failed to process photo upload.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "rgba(10, 14, 31, 0.85)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--ink-2)",
          border: "1px solid var(--ink-3)",
          borderRadius: 24,
          maxWidth: 500,
          width: "100%",
          overflow: "hidden",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
        className="fadeUp"
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid var(--ink-3)" }}>
          <h3 className="serif" style={{ fontSize: 20, color: "var(--paper)", margin: 0 }}>Add Visual Clone</h3>
          <button onClick={onClose} style={{ background: "none", border: 0, color: "var(--paper-dim)", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* Camera/Preview Viewport */}
        <div style={{ position: "relative", width: "100%", aspectRatio: "1/1", background: "#0a0e1f", overflow: "hidden" }}>
          {capturedImage ? (
            /* Preview captured image */
            <img src={capturedImage} alt="Captured" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            /* Live Camera Stream */
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
              />
              
              {/* Silhouette Overlay */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox="0 0 100 100" style={{ width: "80%", height: "80%", opacity: 0.65 }}>
                  {/* Outer Frame Guide */}
                  <circle cx="50" cy="35" r="16" fill="none" stroke="var(--lamp)" strokeWidth="0.8" strokeDasharray="3 3" />
                  <path d="M15,90 C15,65 30,55 50,55 C70,55 85,65 85,90" fill="none" stroke="var(--lamp)" strokeWidth="0.8" strokeDasharray="3 3" />
                  
                  {/* Subtle Text Helper */}
                  <text x="50" y="96" fill="var(--lamp-soft)" fontSize="3.5" textAnchor="middle" letterSpacing="0.05em" fontFamily="monospace">
                    ALIGN HEAD & SHOULDERS
                  </text>
                </svg>
              </div>
            </>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(10,14,31,0.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <Loader2 size={36} className="animate-spin" style={{ color: "var(--lamp)" }} />
              <span className="mono" style={{ color: "var(--paper)", fontSize: 13, letterSpacing: "0.1em" }}>GENERATING CLONE...</span>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div style={{ padding: "12px 24px", background: "rgba(232,133,108,0.1)", borderBottom: "1px solid rgba(232,133,108,0.2)", color: "var(--rose)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: "bold" }}>!</span> {error}
          </div>
        )}

        {/* Control Footer */}
        <div style={{ padding: 24, display: "flex", justifyContent: "center", gap: 12, background: "var(--ink-2)" }}>
          {capturedImage ? (
            /* Controls after capture */
            <>
              <button
                onClick={retakePhoto}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "transparent",
                  color: "var(--paper-dim)",
                  border: "1px solid var(--ink-3)",
                  borderRadius: 99,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <RefreshCw size={16} /> Retake
              </button>
              <button
                onClick={uploadPhoto}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "var(--lamp)",
                  color: "var(--ink-0)",
                  border: "none",
                  borderRadius: 99,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Check size={16} /> Confirm & Upload
              </button>
            </>
          ) : (
            /* Controls during live preview */
            <>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "transparent",
                  color: "var(--paper-dim)",
                  border: "1px solid var(--ink-3)",
                  borderRadius: 99,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                disabled={!cameraActive}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "var(--lamp)",
                  color: "var(--ink-0)",
                  border: "none",
                  borderRadius: 99,
                  cursor: !cameraActive ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: !cameraActive ? 0.6 : 1,
                }}
              >
                <Camera size={16} /> Take Snapshot
              </button>
            </>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
