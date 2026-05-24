"use client";

import { useState, useRef } from "react";
import { Loader2 } from "lucide-react";

export function TestVoiceButton({ voiceId }: { voiceId: string }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleTest = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/voices/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });

      if (!res.ok) {
        throw new Error("Failed to test voice");
      }

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.simulated) {
          alert("Simulation Mode: Testing voice requires an active ElevenLabs API Key. (Audio disabled)");
          setLoading(false);
          return;
        }
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onplay = () => {
        setPlaying(true);
        setLoading(false);
      };
      
      audio.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(url);
      };

      await audio.play();

    } catch (error) {
      console.error(error);
      alert("Error testing voice. Please try again.");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleTest}
      disabled={loading}
      className="flex items-center justify-center gap-2 w-full py-4 text-sm font-semibold bg-white text-[var(--ink-0)] rounded-full hover:bg-[var(--paper)] transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl disabled:opacity-50 disabled:hover:scale-100"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <span className="text-lg leading-none">{playing ? "■" : "▸"}</span>
      )}
      {loading ? "Generating..." : playing ? "Stop Playing" : "Test Voice"}
    </button>
  );
}
