"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/nav";

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const supabase = createClient();
  const [step, setStep] = useState<Step>(1);
  const [plan, setPlan] = useState("free");
  const [voiceName, setVoiceName] = useState("");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"s3" | "direct">("direct");
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

  useEffect(() => {
    async function loadPlan() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("users").select("plan").eq("id", user.id).single();
      if (data?.plan) setPlan(data.plan);
    }
    loadPlan();
  }, []);

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
      setUploadMode(data.uploadMode ?? "direct");

      if (data.uploadMode === "s3" && data.uploadUrl) {
        setUploadUrl(data.uploadUrl);
      }

      setStep(2);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStep2() {
    if (!file || !voiceId) return;
    setError(null);
    setFileError(null);
    setIsLoading(true);

    // Validate MIME type
    const allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/webm", "audio/ogg"];
    const mimeType = file.type || "audio/mpeg";
    if (!allowed.includes(mimeType)) {
      setFileError("Unsupported format. Please upload an MP3, WAV, M4A, or WebM file.");
      setIsLoading(false);
      return;
    }

    try {
      if (uploadMode === "s3" && uploadUrl) {
        // Upload to S3 via presigned URL
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: file,
        });

        if (!uploadRes.ok) {
          setError("Upload failed. Please try again.");
          setIsLoading(false);
          return;
        }
      } else {
        // Upload directly via our API
        const formData = new FormData();
        formData.append("voiceId", voiceId);
        formData.append("audio", file);

        const uploadRes = await fetch("/api/voices/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          setError(data.error || "Upload failed. Please try again.");
          setIsLoading(false);
          return;
        }
      }

      // Move to processing step
      setStep(3);
      setTimedOut(false);
      timeoutRef.current = setTimeout(() => setTimedOut(true), 45_000);

      // Trigger voice processing
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
    <div className="min-h-screen bg-background">
      <Nav plan={plan} />

      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md space-y-8">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 w-16 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>

          {/* Step 1: Name */}
          {step === 1 && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-3xl">🎤</span>
                </div>
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

              {upgradePrompt && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-4 text-left">
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-900">Voice profile limit reached</p>
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

              <p className="text-xs text-muted-foreground">
                Want more control?{" "}
                <Link href="/voice-cloning" className="text-primary hover:underline">
                  Try the Voice Cloning Studio
                </Link>
              </p>
            </div>
          )}

          {/* Step 2: Upload */}
          {step === 2 && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-3xl">📁</span>
                </div>
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
                      MP3, WAV, M4A, or WebM — max 10MB
                    </p>
                  </div>
                )}
              </div>

              {(error || fileError) && (
                <p className="text-sm text-destructive">{fileError ?? error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep(1); setFile(null); setError(null); }}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
                >
                  Back
                </button>
                <button
                  onClick={handleStep2}
                  disabled={!file || isLoading}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                >
                  {isLoading ? "Uploading..." : "Upload & Process"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
                    status === "ready" ? "bg-green-500/10" : status === "failed" ? "bg-red-500/10" : "bg-primary/10"
                  }`}
                >
                  <span className="text-3xl">
                    {status === "ready" ? "✅" : status === "failed" ? "❌" : "⏳"}
                  </span>
                </div>
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
                <>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-1/2 rounded-full bg-primary animate-pulse" />
                  </div>
                  {timedOut && (
                    <p className="text-sm text-muted-foreground">
                      This is taking longer than usual. Please wait...
                    </p>
                  )}
                </>
              )}

              {status === "failed" && (
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setStep(2); setStatus("processing"); setError(null); }}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                  >
                    Try again
                  </button>
                  <Link
                    href="/voice-cloning"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Voice Cloning Studio
                  </Link>
                </div>
              )}

              {status === "ready" && (
                <Link
                  href="/dashboard"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Go to Dashboard
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
