"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, X } from "lucide-react";

export function VoiceCaptureModal({ voiceId, uploadUrl, uploadHeaders, onClose, onComplete }: {
  voiceId: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function start() {
    setError(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      chunks.current = [];
      const nextRecorder = new MediaRecorder(stream.current, { mimeType: "audio/webm" });
      recorder.current = nextRecorder;
      nextRecorder.ondataavailable = (event) => event.data.size && chunks.current.push(event.data);
      nextRecorder.onstop = upload;
      nextRecorder.start();
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch {
      setError("Microphone access is required to record an authorized voice sample.");
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    setRecording(false);
  }

  async function upload() {
    setBusy(true);
    try {
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "audio/webm", ...uploadHeaders },
        body: blob,
      });
      if (!uploadResponse.ok) throw new Error("The private upload failed.");
      const processResponse = await fetch("/api/voices/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });
      const result = await processResponse.json();
      if (!processResponse.ok) throw new Error(result.error ?? "Voice creation failed.");
      onComplete();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Voice creation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="voice-capture-title" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,14,31,.92)", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "min(560px, 100%)", padding: 32, borderRadius: 24, background: "var(--ink-1)", border: "1px solid var(--ink-3)" }}>
        <button aria-label="Close recorder" onClick={onClose} disabled={busy || recording} style={{ float: "right", border: 0, background: "transparent", color: "var(--paper-mute)", cursor: "pointer" }}><X /></button>
        <h2 id="voice-capture-title" className="serif" style={{ fontSize: 32, margin: 0 }}>Record the authorized voice</h2>
        <p style={{ color: "var(--paper-dim)", lineHeight: 1.6 }}>Read naturally for 30–90 seconds in a quiet room. Only the microphone is used; camera access is not requested.</p>
        <div style={{ padding: 20, borderRadius: 16, background: "var(--ink-2)", color: "var(--paper-dim)", lineHeight: 1.65, margin: "22px 0" }}>
          “Bedtime stories are shared moments of comfort and imagination. I authorize this private recording to be used by my family in VoxTree.”
        </div>
        <div aria-live="polite" style={{ textAlign: "center", color: "var(--lamp)", fontSize: 28, marginBottom: 20 }}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</div>
        {error && <p role="alert" style={{ color: "var(--rose)" }}>{error}</p>}
        {busy ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}><Loader2 className="animate-spin" /> Creating private voice…</div>
        ) : recording ? (
          <button onClick={stop} disabled={seconds < 15} style={{ width: "100%", padding: 15, borderRadius: 14, border: 0, background: "var(--rose)", color: "var(--ink-0)", fontWeight: 700, opacity: seconds < 15 ? .5 : 1 }}><Square size={17} style={{ display: "inline", marginRight: 8 }} /> Stop and submit</button>
        ) : (
          <button onClick={start} style={{ width: "100%", padding: 15, borderRadius: 14, border: 0, background: "var(--lamp)", color: "var(--ink-0)", fontWeight: 700 }}><Mic size={18} style={{ display: "inline", marginRight: 8 }} /> Start recording</button>
        )}
      </div>
    </div>
  );
}
