"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [voiceName, setVoiceName] = useState("");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [s3Key, setS3Key] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("processing");
  const [error, setError] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  async function handleStep1() {
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
      setUploadUrl(data.uploadUrl);
      setS3Key(data.s3Key);
      setStep(2);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStep2() {
    if (!file || !uploadUrl || !voiceId || !s3Key) return;
    setError(null);
    setIsLoading(true);

    // Validate MIME type
    const allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/m4a"];
    const mimeType = file.type || "audio/mpeg";
    if (!allowed.includes(mimeType)) {
      setFileError("Unsupported format. Please upload an MP3, WAV, or M4A file.");
      setIsLoading(false);
      return;
    }

    try {
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: file,
      });

      if (!uploadRes.ok) {
        setError("Upload failed. Please try again.");
        return;
      }

      setStep(3);
      setTimedOut(false);

      // Show timeout warning after 45 seconds
      timeoutRef.current = setTimeout(() => setTimedOut(true), 45_000);

      const processRes = await fetch("/api/voices/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });

      const processData = await processRes.json();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setStatus(processData.status ?? "failed");

      if (processData.status === "ready") {
        setTimeout(() => router.push("/dashboard"), 2000);
      }
    } catch {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setError("Processing failed. Please try again.");
      setStatus("failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full ${s <= step ? "bg-primary" : "bg-muted"
                }`}
            />
          ))}
        </div>

        {/* Step 1: Name */}
        {step === 1 && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">
                Who will be reading to your kids?
              </h1>
              <p className="text-muted-foreground">
                Enter the name of the family member whose voice you&apos;d like
                to clone.
              </p>
            </div>

            <input
              type="text"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder='e.g. "Grandma Sue"'
              className="flex h-12 w-full rounded-md border border-input bg-background px-4 py-2 text-lg ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Voice limit upsell modal */}
            {upgradePrompt && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-4 text-left">
                <div className="space-y-1">
                  <p className="font-semibold text-amber-900">
                    Voice profile limit reached
                  </p>
                  <p className="text-sm text-amber-700">{upgradePrompt}</p>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/pricing"
                    className="flex-1 inline-flex h-9 items-center justify-center rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700"
                  >
                    View Plans
                  </Link>
                  <button
                    onClick={() => setUpgradePrompt(null)}
                    className="flex-1 inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {!upgradePrompt && (
              <button
                onClick={handleStep1}
                disabled={!voiceName.trim() || isLoading}
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              >
                {isLoading ? "Creating..." : "Continue"}
              </button>
            )}
          </div>
        )}

        {/* Step 2: Upload */}
        {step === 2 && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Upload a voice sample</h1>
              <p className="text-muted-foreground">
                Upload a 30-60 second audio recording of {voiceName} speaking
                naturally. The clearer the recording, the better the voice
                clone.
              </p>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const chosen = e.target.files?.[0] ?? null;
                  setFile(chosen);
                  setFileError(null);
                }}
              />
              {file ? (
                <div className="space-y-1">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium">Click to upload audio</p>
                  <p className="text-sm text-muted-foreground">
                    MP3, WAV, or M4A — max 10MB
                  </p>
                </div>
              )}
            </div>

            {(error || fileError) && (
              <p className="text-sm text-destructive">{fileError ?? error}</p>
            )}

            <button
              onClick={handleStep2}
              disabled={!file || isLoading}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoading ? "Uploading..." : "Upload & Process"}
            </button>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 3 && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">
                {status === "ready"
                  ? "Voice is ready!"
                  : status === "failed"
                    ? "Something went wrong"
                    : "Processing voice..."}
              </h1>
              <p className="text-muted-foreground">
                {status === "ready"
                  ? `${voiceName}'s voice has been cloned successfully. Redirecting to your dashboard...`
                  : status === "failed"
                    ? "Voice cloning failed. Please try again with a different audio sample."
                    : `We're cloning ${voiceName}'s voice. This usually takes 1-2 minutes.`}
              </p>
            </div>

            {status === "processing" && (
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full w-1/2 rounded-full bg-primary animate-pulse" />
              </div>
            )}

            {status === "failed" && (
              <button
                onClick={() => setStep(2)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
