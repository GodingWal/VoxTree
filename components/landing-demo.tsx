"use client";

import { useState, useEffect } from "react";
import { Play, Pause, Sparkles, Volume2, ArrowRight } from "lucide-react";

interface Narrator {
  id: string;
  name: string;
  role: string;
  desc: string;
  avatar: string;
}

interface StorySnippet {
  id: string;
  title: string;
  category: string;
  text: string;
}

const NARRATORS: Narrator[] = [
  {
    id: "grandma",
    name: "Grandma Sarah",
    role: "Bedtime Storyteller",
    desc: "Warm, gentle, and comforting, perfect for lulling kids to sleep.",
    avatar: "👵",
  },
  {
    id: "grandpa",
    name: "Grandpa Arthur",
    role: "Wise & Engaging",
    desc: "Gravely, warm, and highly expressive, great for historic adventures.",
    avatar: "👴",
  },
  {
    id: "aunt",
    name: "Aunt Sophie",
    role: "Energetic Explorer",
    desc: "Bright, cheerful, and enthusiastic, perfect for educational science tales.",
    avatar: "👩‍🦰",
  },
];

const SNIPPETS: StorySnippet[] = [
  {
    id: "pip",
    title: "Pip the Sleepy Owl",
    category: "Bedtime",
    text: "Once upon a time, high in the sleepy branches of the whispering pine, a tiny owl named Pip was tucking in his feathers. The moon was a soft silver crescent, casting warm light on the forest below. 'Goodnight, stars,' Pip whispered...",
  },
  {
    id: "roots",
    title: "The Whispering Forest",
    category: "Science",
    text: "Did you know that trees talk to each other? Deep beneath the mossy forest floor, a vast, secret network of roots and mycelium acts like a natural internet. When a tiny oak seedling needs water, the older mother trees send nutrients right through the soil...",
  },
  {
    id: "leo",
    title: "Leo's Golden Temple",
    category: "Adventure",
    text: "With a leap and a bound, Leo the explorer monkey swung across the massive green vines! The map in his satchel was glowing. Just past the waterfall, the legendary golden temple of VoxTree stood shimmering in the midday sun...",
  },
];

export function LandingDemo() {
  const [selectedNarrator, setSelectedNarrator] = useState<string>("grandma");
  const [selectedSnippet, setSelectedSnippet] = useState<string>("pip");
  const [status, setStatus] = useState<"idle" | "generating" | "playing">("idle");
  const [progress, setProgress] = useState(0);

  const narrator = NARRATORS.find((n) => n.id === selectedNarrator) || NARRATORS[0];
  const snippet = SNIPPETS.find((s) => s.id === selectedSnippet) || SNIPPETS[0];

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === "generating") {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setStatus("playing");
            return 100;
          }
          return prev + 5;
        });
      }, 100);
      return () => clearInterval(interval);
    } else if (status === "playing") {
      // Simulate playback finishing after 10 seconds
      timer = setTimeout(() => {
        setStatus("idle");
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleAction = () => {
    if (status === "idle") {
      setStatus("generating");
    } else if (status === "playing") {
      setStatus("idle");
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white dark:bg-card border border-brand-sage/20 dark:border-border rounded-2xl shadow-xl overflow-hidden p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-brand-green/10 text-brand-green">
            <Volume2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-brand-charcoal dark:text-foreground">
              Voice Sandbox
            </h3>
            <p className="text-xs text-muted-foreground">
              Test how custom cloned voices read children's books
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs bg-brand-gold/10 text-brand-gold px-2 py-1 rounded-full font-medium">
          <Sparkles className="h-3 w-3 animate-pulse" />
          Try Clones
        </span>
      </div>

      {/* Narrators Selection */}
      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
          1. Select a Narrator
        </label>
        <div className="grid grid-cols-3 gap-3">
          {NARRATORS.map((n) => (
            <button
              key={n.id}
              disabled={status !== "idle"}
              onClick={() => setSelectedNarrator(n.id)}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-32 ${
                selectedNarrator === n.id
                  ? "border-brand-green bg-brand-green/5 ring-1 ring-brand-green"
                  : "border-border bg-card hover:bg-muted/50"
              } ${status !== "idle" ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="text-2xl">{n.avatar}</span>
              <div>
                <h4 className="font-bold text-sm text-brand-charcoal dark:text-foreground line-clamp-1">
                  {n.name}
                </h4>
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  {n.role}
                </p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground italic bg-brand-cream/50 dark:bg-muted/30 p-2.5 rounded-lg border border-brand-sage/10">
          "{narrator.desc}"
        </p>
      </div>

      {/* Snippets Selection */}
      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
          2. Select a Story Snippet
        </label>
        <div className="flex gap-2">
          {SNIPPETS.map((s) => (
            <button
              key={s.id}
              disabled={status !== "idle"}
              onClick={() => setSelectedSnippet(s.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                selectedSnippet === s.id
                  ? "bg-brand-charcoal text-white dark:bg-white dark:text-brand-charcoal border-transparent"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 border-transparent"
              } ${status !== "idle" ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {s.title}
            </button>
          ))}
        </div>
        <div className="bg-muted/40 border rounded-xl p-4 min-h-[90px] relative">
          <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider font-semibold text-brand-coral/80 bg-brand-coral/10 px-2 py-0.5 rounded">
            {snippet.category}
          </span>
          <p className="text-xs text-brand-charcoal dark:text-muted-foreground leading-relaxed pr-8">
            {snippet.text}
          </p>
        </div>
      </div>

      {/* Synthesis controls and player */}
      <div className="pt-2">
        {status === "idle" && (
          <button
            onClick={handleAction}
            className="w-full bg-brand-green text-white hover:bg-brand-green/90 transition-all font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 group hover:shadow-lg shadow-brand-green/20"
          >
            <Play className="h-4 w-4 fill-white" />
            Synthesize Voice & Read
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        )}

        {status === "generating" && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5 animate-pulse text-brand-green">
                <Sparkles className="h-3.5 w-3.5" /> Cloned Voice Reading...
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-green rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === "playing" && (
          <div className="bg-brand-cream/60 dark:bg-muted/20 border border-brand-sage/20 rounded-xl p-4 flex items-center gap-4 animate-fade-in">
            <button
              onClick={handleAction}
              className="h-12 w-12 rounded-full bg-brand-coral text-white hover:bg-brand-coral/90 flex items-center justify-center transition-colors shadow-md shrink-0"
            >
              <Pause className="h-5 w-5 fill-white" />
            </button>
            <div className="flex-1 space-y-1.5 overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-charcoal dark:text-foreground">
                  Now Reading: {narrator.name}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  0:05 / 0:10
                </span>
              </div>

              {/* Animated waveform bars */}
              <div className="flex items-end gap-[3px] h-6 px-1">
                {Array.from({ length: 30 }).map((_, i) => {
                  // Create different animation delays and heights
                  const delay = (i % 5) * 0.15;
                  const duration = 0.6 + (i % 3) * 0.2;
                  return (
                    <div
                      key={i}
                      className="bg-brand-green dark:bg-primary w-[3px] rounded-full"
                      style={{
                        animationName: "bounce-bar",
                        animationDuration: `${duration}s`,
                        animationIterationCount: "infinite",
                        animationTimingFunction: "ease-in-out",
                        animationDelay: `${delay}s`,
                        height: `${20 + (i % 6) * 12}%`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSS Animation injection */}
      <style jsx global>{`
        @keyframes bounce-bar {
          0%, 100% {
            transform: scaleY(0.4);
          }
          50% {
            transform: scaleY(1.2);
          }
        }
      `}</style>
    </div>
  );
}
