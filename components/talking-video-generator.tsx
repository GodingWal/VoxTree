"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Sparkles } from "lucide-react";

interface Props {
  voiceId: string;
  /** Disable if the voice clone or Pixar avatar isn't ready yet. */
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Generate a talking-head Pixar video: ElevenLabs renders the cloned voice
 * speaking the prompt, then Hedra Character-3 drives the Pixar still with
 * that audio. The component polls /api/clips/talking-video/status until the
 * MP4 is ready and inlines it for playback.
 */
export function TalkingVideoGenerator({ voiceId, disabled, disabledReason }: Props) {
  const [text, setText] = useState(
    "Hi there! I just learned how to talk like a real Pixar character."
  );
  const [aspect, setAspect] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "ready" | "failed">("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [clipId, setClipId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 60) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus("failed");
        setError("Generation timed out. Try again or shorten the text.");
        return;
      }
      try {
        const res = await fetch(`/api/clips/talking-video/status?clipId=${id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "ready" && data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setStatus("ready");
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === "failed") {
          setStatus("failed");
          setError("Hedra reported a failure. Check API key and try again.");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
    }, 4000);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setVideoUrl(null);
    setStatus("processing");
    try {
      const res = await fetch("/api/clips/talking-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId, text, aspectRatio: aspect }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start generation");
      setClipId(data.clipId);
      startPolling(data.clipId);
    } catch (err: any) {
      setStatus("failed");
      setError(err?.message ?? "Failed to start generation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[2rem] border border-[var(--ink-3)] bg-[var(--ink-1)] p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[var(--moss)]/10 to-transparent blur-3xl rounded-full pointer-events-none" />

      <div className="relative z-10 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--moss)]/15 text-[var(--moss)] border border-[var(--moss)]/30">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-serif text-2xl text-white">Talking Pixar Clip</h3>
            <p className="text-sm text-[var(--paper-dim)]">
              ElevenLabs voice + Hedra Character-3 lip-sync.
            </p>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={1000}
          disabled={disabled || submitting || status === "processing"}
          className="w-full rounded-2xl bg-[var(--ink-2)] border border-[var(--ink-3)] text-white px-4 py-3 text-sm placeholder:text-[var(--paper-mute)] focus:outline-none focus:border-[var(--lamp)]/40 disabled:opacity-50"
          placeholder="What should they say?"
        />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="mono text-xs text-[var(--paper-mute)] uppercase tracking-wider mr-1">
            Aspect
          </span>
          {(["9:16", "1:1", "16:9"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAspect(a)}
              disabled={status === "processing"}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                aspect === a
                  ? "bg-[var(--lamp)] text-[var(--ink-0)] border-[var(--lamp)]"
                  : "bg-[var(--ink-2)] text-[var(--paper-dim)] border-[var(--ink-3)] hover:text-white"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {disabled && disabledReason && (
          <div className="rounded-xl border border-[var(--ink-3)] bg-[var(--ink-2)] text-[var(--paper-dim)] text-sm px-4 py-3">
            {disabledReason}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs text-[var(--paper-mute)]">{text.length} / 1000</div>
          <button
            onClick={submit}
            disabled={
              disabled ||
              submitting ||
              status === "processing" ||
              text.trim().length < 2
            }
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-[var(--lamp)] text-[var(--ink-0)] hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting || status === "processing" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {status === "processing" ? "Rendering…" : "Starting…"}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Talking Clip
              </>
            )}
          </button>
        </div>

        {status === "ready" && videoUrl && (
          <div className="rounded-2xl border border-[var(--lamp)]/30 bg-black overflow-hidden">
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-auto"
            />
          </div>
        )}

        {status === "processing" && (
          <div className="rounded-2xl border border-[var(--ink-3)] bg-[var(--ink-2)] text-sm text-[var(--paper-dim)] px-4 py-6 text-center">
            Rendering Pixar lip-sync — usually 30–90 seconds.
          </div>
        )}
      </div>
    </div>
  );
}
