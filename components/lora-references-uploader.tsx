"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Upload, X } from "lucide-react";

interface Props {
  voiceId: string;
  /** Reference image URLs already attached (e.g. captured from onboarding). */
  initialReferences?: string[];
  initialStatus?: "not_started" | "training" | "ready" | "failed" | string | null;
  initialTriggerWord?: string | null;
  onReady?: (triggerWord: string) => void;
}

const MIN_IMAGES = 4;
const MAX_IMAGES = 20;

/**
 * Upload 4–20 reference photos of a family member and train a personalized
 * Flux LoRA. Once training finishes, the Pixar generator on the clone-details
 * page can call /api/avatar/generate-pixar to produce truly identity-faithful
 * portraits.
 */
export function LoraReferencesUploader({
  voiceId,
  initialReferences = [],
  initialStatus,
  initialTriggerWord,
  onReady,
}: Props) {
  const [existing] = useState<string[]>(initialReferences);
  const [extras, setExtras] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [status, setStatus] = useState<string>(initialStatus ?? "not_started");
  const [trigger, setTrigger] = useState<string | null>(initialTriggerWord ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Generate object-URL previews for the staged files; revoke on change.
  useEffect(() => {
    const urls = extras.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [extras]);

  // Poll training status while it's in flight so the UI lights up on its own.
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

  const totalCount = existing.length + extras.length;
  const canSubmit =
    !submitting && status !== "training" && totalCount >= MIN_IMAGES && extras.length > 0;

  const handlePick = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setExtras((prev) => [...prev, ...incoming].slice(0, MAX_IMAGES));
    setError(null);
  };

  const removeExtra = (index: number) => {
    setExtras((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (totalCount < MIN_IMAGES) {
      setError(`Add at least ${MIN_IMAGES} reference photos (you have ${totalCount}).`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("voiceId", voiceId);
      extras.forEach((f, i) => formData.append("images", f, f.name || `ref_${i}.jpg`));

      const res = await fetch("/api/avatar/train", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Training failed to start");

      setStatus("training");
      if (data.triggerWord) setTrigger(data.triggerWord);
      setExtras([]);
    } catch (err: any) {
      setError(err?.message ?? "Could not start training");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[2rem] border border-[var(--ink-3)] bg-[var(--ink-1)] p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[var(--lamp)]/10 to-transparent blur-3xl rounded-full pointer-events-none" />

      <div className="relative z-10 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[var(--lamp)]" />
              <span className="rounded-full bg-[var(--lamp)]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--lamp-soft)] border border-[var(--lamp)]/30">
                Identity LoRA
              </span>
            </div>
            <h3 className="font-serif text-3xl text-white">Train the Truest Clone</h3>
            <p className="text-[var(--paper-dim)] leading-relaxed">
              Upload 4–20 varied photos (different angles, expressions, lighting).
              A personalized Flux LoRA learns this specific face, then we stack
              it with a Pixar style LoRA for portraits that hold the likeness
              across every future scene.
            </p>
          </div>

          <StatusBadge status={status} trigger={trigger} />
        </div>

        {existing.length > 0 && (
          <div>
            <div className="mono text-xs text-[var(--paper-mute)] uppercase tracking-wider mb-2">
              Captured during onboarding ({existing.length})
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {existing.map((u, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl overflow-hidden border border-[var(--ink-3)] bg-[var(--ink-2)]"
                >
                  <img src={u} alt={`reference ${i}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mono text-xs text-[var(--paper-mute)] uppercase tracking-wider mb-2">
            New uploads ({extras.length})
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed border-[var(--ink-3)] hover:border-[var(--lamp)]/50 bg-[var(--ink-2)]/40 p-8 flex flex-col items-center gap-2 text-[var(--paper-dim)] hover:text-white transition-colors"
          >
            <Upload className="h-6 w-6" />
            <span className="text-sm">Click to add photos (JPG/PNG, up to {MAX_IMAGES})</span>
            <span className="text-xs text-[var(--paper-mute)]">
              Tip: more variety = better identity capture
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handlePick(e.target.files)}
          />

          {previews.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
              {previews.map((u, i) => (
                <div
                  key={u}
                  className="relative aspect-square rounded-xl overflow-hidden border border-[var(--ink-3)] bg-[var(--ink-2)] group"
                >
                  <img src={u} alt={`preview ${i}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeExtra(i)}
                    className="absolute top-1 right-1 rounded-full bg-black/60 hover:bg-black p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-[var(--paper-dim)]">
            {totalCount < MIN_IMAGES
              ? `Need ${MIN_IMAGES - totalCount} more photo${MIN_IMAGES - totalCount === 1 ? "" : "s"}.`
              : `${totalCount} photos staged.`}
          </div>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-[var(--lamp)] text-[var(--ink-0)] hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting…
              </>
            ) : status === "training" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Training…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {status === "ready" ? "Re-train" : "Train Identity LoRA"}
              </>
            )}
          </button>
        </div>
      </div>
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
      <div className="rounded-2xl border border-[var(--moss)]/30 bg-[var(--moss)]/10 px-4 py-3 text-sm">
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
      <div className="rounded-2xl border border-[var(--lamp)]/30 bg-[var(--lamp)]/10 px-4 py-3 text-sm flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--lamp)]" />
        <div className="text-[var(--lamp)] font-semibold uppercase tracking-wider text-xs">
          Training
        </div>
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        Training failed
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[var(--ink-3)] bg-[var(--ink-2)] px-4 py-3 text-xs text-[var(--paper-dim)]">
      Not trained yet
    </div>
  );
}
