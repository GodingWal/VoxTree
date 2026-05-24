"use client";

import { useState } from "react";
import { Plus, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function TrainSingingButton({ voiceId, initialStatus, trainingId }: { voiceId: string, initialStatus: string | null, trainingId: string | null }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleTrain = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/voices/singing/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });
      if (!res.ok) throw new Error("Failed to start training");
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Error starting training. Ensure you have an audio sample.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/voices/singing/status?id=${voiceId}`);
      await res.json();
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (initialStatus === "processing") {
    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="flex items-center justify-between w-full p-3 rounded-md border border-[var(--lamp)]/20 bg-[var(--lamp)]/5 text-[var(--lamp)]">
          <div className="flex items-center gap-2 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Training in progress...
          </div>
          <button onClick={handleCheckStatus} disabled={loading} className="text-xs flex items-center gap-1 hover:text-white transition-colors bg-transparent border-0 cursor-pointer text-[var(--lamp)]">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Check Status
          </button>
        </div>
      </div>
    );
  }

  return (
    <button 
      onClick={handleTrain} 
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--lamp)]/50 px-4 py-3 text-sm font-medium text-[var(--lamp)] hover:bg-[var(--lamp)]/5 transition-colors disabled:opacity-50 cursor-pointer"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      {loading ? "Starting..." : "Train Model"}
    </button>
  );
}
