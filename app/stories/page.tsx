"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ───── types ───── */

type StoryCategory = "BEDTIME" | "CLASSIC" | "FAIRYTALE" | "ADVENTURE" | "EDUCATIONAL" | "CUSTOM" | string;

interface StorySummary {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  category: StoryCategory;
  rights: string;
  tags: string[];
  coverUrl: string | null;
  summary: string | null;
  ageRange: { min: number | null; max: number | null };
  durationMin: number | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
}

interface VoiceProfile {
  id: string;
  name: string;
  displayName?: string;
  status?: string;
}

interface StorySection {
  id: string;
  index: number;
  title: string | null;
  wordCount: number;
  text?: string;
}

interface StoryAudioEntry {
  status: string;
  audioUrl: string | null;
  durationSec: number | null;
  error: string | null;
}

interface StoryAudioSection extends StorySection {
  audio: StoryAudioEntry;
}

interface StoryDetailResponse extends StorySummary {
  content?: string;
  sections: StorySection[];
}

interface StoryAudioResponse {
  story: StorySummary;
  voice: { id: string; displayName?: string };
  sections: StoryAudioSection[];
}

interface StoryListResponse {
  total: number;
  stories: StorySummary[];
}

interface ReadResponse {
  ready: boolean;
  jobId: string | null;
  state?: string;
  progress?: number;
  story: { id: string; slug: string; title: string };
  voice: { id: string; displayName?: string };
  sections?: StoryAudioSection[];
}

interface StoryJobStatus {
  id: string;
  state: string;
  progress: number;
  totalSections?: number;
  completedSections?: number;
  estimatedSecondsRemaining?: number | null;
  failedReason: string | null;
}

interface ActiveJob {
  jobId: string;
  slug: string;
  voiceId: string;
}

/* ───── constants ───── */

const EMPTY_AUDIO: StoryAudioEntry = {
  status: "PENDING",
  audioUrl: null,
  durationSec: null,
  error: null,
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-slate-200 text-slate-700 border border-slate-300",
  QUEUED: "bg-amber-100 text-amber-700 border border-amber-300",
  PROCESSING: "bg-sky-100 text-sky-700 border border-sky-300",
  COMPLETE: "bg-emerald-100 text-emerald-700 border border-emerald-300",
  ERROR: "bg-rose-100 text-rose-700 border border-rose-300",
};

const JOB_STATE_LABEL: Record<string, string> = {
  waiting: "Waiting in queue",
  delayed: "Delayed",
  active: "Generating audio",
  completed: "Completed",
  failed: "Failed",
};

const jobStateBadge = (state: string) => {
  switch (state) {
    case "completed": return "bg-emerald-100 text-emerald-700 border border-emerald-300";
    case "active": return "bg-sky-100 text-sky-700 border border-sky-300";
    case "failed": return "bg-rose-100 text-rose-700 border border-rose-300";
    case "waiting": return "bg-amber-100 text-amber-700 border border-amber-300";
    default: return "bg-slate-200 text-slate-700 border border-slate-300";
  }
};

const CATEGORY_ICONS: Record<string, string> = {
  BEDTIME: "🌙",
  CLASSIC: "📚",
  FAIRYTALE: "🏰",
  ADVENTURE: "🚀",
  EDUCATIONAL: "🎓",
  CUSTOM: "✨",
  UNCATEGORIZED: "📖",
};

const formatMinutes = (m: number | null | undefined) => {
  if (!m || Number.isNaN(m)) return null;
  if (m < 1) return "<1 minute";
  if (m < 60) return `${Math.round(m)} minute${m >= 1.5 ? "s" : ""}`;
  const h = m / 60;
  return h < 3 ? `${h.toFixed(1)} hours` : `${Math.round(h)} hours`;
};

const formatSecondsRemaining = (s: number | null | undefined) => {
  if (s === null || s === undefined || Number.isNaN(s)) return null;
  if (s < 5) return "Almost done...";
  if (s < 60) return `About ${Math.ceil(s / 5) * 5} seconds remaining`;
  const m = Math.ceil(s / 60);
  return m === 1 ? "About 1 minute remaining" : `About ${m} minutes remaining`;
};

/* ───── component ───── */

export default function StoriesPage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("free");

  // Data
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [storiesTotal, setStoriesTotal] = useState(0);
  const [storiesError, setStoriesError] = useState(false);
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);

  // Selections
  const [selectedVoiceProfile, setSelectedVoiceProfile] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Story detail & audio
  const [storyDetail, setStoryDetail] = useState<StoryDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [storyAudioData, setStoryAudioData] = useState<StoryAudioResponse | null>(null);
  const [audioFetching, setAudioFetching] = useState(false);

  // Job tracking
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [jobStatus, setJobStatus] = useState<StoryJobStatus | null>(null);
  const [narrating, setNarrating] = useState(false);

  // Play-all
  const [isPlayAll, setIsPlayAll] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const playAllAudioRef = useRef<HTMLAudioElement | null>(null);

  /* ── initial load ── */
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [profileRes, storiesRes, voicesRes] = await Promise.all([
        supabase.from("users").select("plan").eq("id", user.id).single(),
        fetch("/api/stories").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/voice-profiles").then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      setPlan(profileRes.data?.plan ?? "free");

      if (storiesRes && storiesRes.stories) {
        setStories(storiesRes.stories);
        setStoriesTotal(storiesRes.total ?? storiesRes.stories.length);
      } else {
        setStoriesError(true);
      }

      if (Array.isArray(voicesRes)) {
        setVoiceProfiles(voicesRes);
        if (voicesRes.length > 0) setSelectedVoiceProfile(voicesRes[0].id);
      }
      setVoicesLoading(false);
      setLoading(false);
    }
    load();
  }, []);

  /* ── auto-select first story ── */
  useEffect(() => {
    if (!selectedSlug && stories.length > 0) setSelectedSlug(stories[0].slug);
  }, [stories, selectedSlug]);

  /* ── derived ── */
  const selectedVoice = useMemo(
    () => voiceProfiles.find(p => p.id === selectedVoiceProfile) ?? null,
    [voiceProfiles, selectedVoiceProfile]
  );

  const categories = useMemo(
    () => Array.from(new Set(stories.map(s => s.category || "UNCATEGORIZED"))).sort(),
    [stories]
  );

  const filteredStories = useMemo(() => {
    if (categoryFilter === "ALL") return stories;
    return stories.filter(s => (s.category || "UNCATEGORIZED").toUpperCase() === categoryFilter.toUpperCase());
  }, [stories, categoryFilter]);

  const selectedStorySummary = useMemo(
    () => stories.find(s => s.slug === selectedSlug) ?? null,
    [stories, selectedSlug]
  );

  /* ── fetch story detail ── */
  useEffect(() => {
    if (!selectedSlug) return;
    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/stories/${selectedSlug}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setStoryDetail(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedSlug]);

  /* ── fetch story audio ── */
  const fetchStoryAudio = () => {
    if (!selectedSlug || !selectedVoiceProfile) return;
    setAudioFetching(true);
    fetch(`/api/stories/${selectedSlug}/audio?voiceId=${encodeURIComponent(selectedVoiceProfile)}`)
      .then(r => r.json())
      .then(data => setStoryAudioData(data))
      .catch(() => {})
      .finally(() => setAudioFetching(false));
  };

  useEffect(() => {
    fetchStoryAudio();
  }, [selectedSlug, selectedVoiceProfile]);

  /* ── merge sections ── */
  const mergedSections: StoryAudioSection[] = useMemo(() => {
    const base = storyDetail?.sections ?? storyAudioData?.sections ?? [];
    const audioLookup = new Map(
      (storyAudioData?.sections ?? []).map(s => [s.id, s.audio])
    );
    if (storyAudioData?.sections && storyDetail?.sections) {
      return storyDetail.sections.map(s => ({
        ...s,
        audio: audioLookup.get(s.id) ?? EMPTY_AUDIO,
      }));
    }
    return base.map(s => ({
      ...s,
      audio: (s as StoryAudioSection).audio ?? audioLookup.get(s.id) ?? EMPTY_AUDIO,
    }));
  }, [storyDetail, storyAudioData]);

  const playableSections = useMemo(
    () => mergedSections.filter(s => Boolean(s.audio?.audioUrl)),
    [mergedSections]
  );

  /* ── play-all logic ── */
  useEffect(() => {
    setIsPlayAll(false);
    setPlayIndex(0);
    if (playAllAudioRef.current) {
      playAllAudioRef.current.pause();
      playAllAudioRef.current.src = "";
    }
  }, [selectedSlug, selectedVoiceProfile]);

  useEffect(() => {
    const el = playAllAudioRef.current;
    if (!el || !isPlayAll) return;
    const current = playableSections[playIndex];
    if (!current?.audio?.audioUrl) return;
    if (el.src !== new URL(current.audio.audioUrl, window.location.origin).toString()) {
      el.src = current.audio.audioUrl;
    }
    el.play().catch(() => {});
  }, [isPlayAll, playIndex, playableSections]);

  const nextSection = () => {
    setPlayIndex(idx => {
      const next = idx + 1;
      if (next >= playableSections.length) { setIsPlayAll(false); return idx; }
      return next;
    });
  };

  const prevSection = () => setPlayIndex(idx => Math.max(0, idx - 1));

  const handlePlayAllToggle = () => {
    if (playableSections.length === 0) return;
    if (!isPlayAll) {
      setPlayIndex(idx => (idx < playableSections.length ? idx : 0));
      setIsPlayAll(true);
    } else {
      setIsPlayAll(false);
      playAllAudioRef.current?.pause();
    }
  };

  /* ── job polling ── */
  useEffect(() => {
    if (!activeJob) { setJobStatus(null); return; }
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${activeJob.jobId}`);
        const data: StoryJobStatus = await res.json();
        if (cancelled) return;
        setJobStatus(data);

        if (data.state === "active") fetchStoryAudio();

        if (data.state === "completed") {
          toast({ title: "Story narration ready", description: "All sections have completed synthesis." });
          fetchStoryAudio();
          setActiveJob(null);
          return;
        }
        if (data.state === "failed") {
          toast({ title: "Narration failed", description: data.failedReason ?? "Could not complete narration.", variant: "destructive" });
          setActiveJob(null);
          return;
        }
        timeoutId = setTimeout(poll, 3000);
      } catch {
        if (!cancelled) timeoutId = setTimeout(poll, 5000);
      }
    };
    poll();
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [activeJob]);

  /* ── narration request ── */
  const handleNarrate = async (force?: boolean) => {
    if (!selectedVoiceProfile) {
      toast({ title: "Select a voice", description: "Choose a voice profile first.", variant: "destructive" });
      return;
    }
    if (selectedVoice?.status && selectedVoice.status !== "ready") {
      toast({ title: "Voice not ready", description: "Pick a ready voice profile.", variant: "destructive" });
      return;
    }
    setNarrating(true);
    try {
      const res = await fetch(`/api/stories/${selectedSlug}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: selectedVoiceProfile, force }),
      });
      const data: ReadResponse = await res.json();

      if (data.ready) {
        toast({ title: "Narration ready", description: "Completed sections found." });
        fetchStoryAudio();
        setActiveJob(null);
        setJobStatus(null);
      } else if (data.jobId) {
        toast({ title: "Narration queued", description: "We'll keep you posted as each section completes." });
        setActiveJob({ jobId: data.jobId, slug: data.story.slug, voiceId: selectedVoiceProfile! });
        setJobStatus({
          id: data.jobId,
          state: data.state ?? "waiting",
          progress: data.progress ?? 0,
          failedReason: null,
        });
      } else {
        toast({ title: "Narration requested", description: "Story queued for processing." });
      }
    } catch {
      toast({ title: "Narration failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setNarrating(false);
    }
  };

  /* ── loading ── */
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav plan={plan} />

      <div className="container mx-auto px-4 pt-24 pb-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 border border-primary/20">
            <span>📖</span> Story Library
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3">Family Stories</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base leading-relaxed">
            Discover curated stories for every member of the family. Pick a voice you love and generate immersive narration with a single click.
          </p>
        </div>

        <Card className="bg-card border border-border shadow-sm">
          {/* Voice selector header */}
          <CardHeader className="md:flex md:items-start md:justify-between gap-6 border-b border-border/50 pb-6">
            <div className="md:flex-1">
              <CardTitle className="text-foreground">Narration Voice</CardTitle>
              <CardDescription>Choose a voice profile to use when generating story narrations.</CardDescription>
            </div>
            <div className="md:w-64 lg:w-72 mt-4 md:mt-0">
              {voicesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : voiceProfiles.length > 0 ? (
                <Select value={selectedVoiceProfile ?? undefined} onValueChange={setSelectedVoiceProfile}>
                  <SelectTrigger><SelectValue placeholder="Select a voice" /></SelectTrigger>
                  <SelectContent>
                    {voiceProfiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.displayName ?? p.name}
                        {p.status && p.status !== "ready" ? ` · ${p.status}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">No voice profiles found. Visit Voice Cloning to create one.</p>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {stories.length === 0 && !storiesError ? (
              <div className="text-center text-muted-foreground py-12">No stories are available yet. Check back soon!</div>
            ) : storiesError ? (
              <div className="text-center text-muted-foreground py-12">Could not load stories. Please try again later.</div>
            ) : (
              <div className="space-y-6">
                {/* Category filters */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setCategoryFilter("ALL")}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                        categoryFilter === "ALL"
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      All ({storiesTotal || stories.length})
                    </button>
                    {categories.map(cat => {
                      const icon = CATEGORY_ICONS[cat?.toUpperCase()] || CATEGORY_ICONS.UNCATEGORIZED;
                      const count = stories.filter(s => (s.category || "UNCATEGORIZED").toUpperCase() === cat.toUpperCase()).length;
                      return (
                        <button
                          key={cat}
                          onClick={() => setCategoryFilter(cat)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5",
                            categoryFilter === cat
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                          )}
                        >
                          <span>{icon}</span> {cat} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {selectedStorySummary && selectedVoiceProfile && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-accent/20 text-accent-foreground border border-accent/40 text-xs">
                        {selectedStorySummary.title} · {selectedVoice?.displayName ?? selectedVoice?.name ?? "Voice"}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Grid: story list + detail */}
                <div className="grid gap-4 lg:grid-cols-[2fr,3fr]">
                  {/* Story list */}
                  <div className="space-y-3">
                    {filteredStories.map(story => {
                      const dur = formatMinutes(story.durationMin);
                      const isSelected = story.slug === selectedSlug;
                      const icon = CATEGORY_ICONS[story.category?.toUpperCase()] || CATEGORY_ICONS.UNCATEGORIZED;
                      return (
                        <button
                          key={story.id}
                          onClick={() => setSelectedSlug(story.slug)}
                          className={cn(
                            "w-full rounded-xl border bg-card p-3 text-left transition-all group",
                            isSelected
                              ? "border-primary ring-2 ring-primary/30 shadow-md bg-primary/5"
                              : "border-border hover:border-primary/50 hover:shadow-md hover:bg-accent/5"
                          )}
                        >
                          <div className="flex gap-3">
                            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted border border-border/50 shadow-sm">
                              {story.coverUrl ? (
                                <img src={story.coverUrl} alt={story.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                              ) : (
                                <div className={cn(
                                  "flex h-full w-full items-center justify-center text-3xl",
                                  story.category === "BEDTIME" && "bg-gradient-to-br from-indigo-500/20 to-purple-500/20",
                                  story.category === "CLASSIC" && "bg-gradient-to-br from-amber-500/20 to-orange-500/20",
                                  story.category === "FAIRYTALE" && "bg-gradient-to-br from-pink-500/20 to-rose-500/20",
                                  story.category === "ADVENTURE" && "bg-gradient-to-br from-sky-500/20 to-cyan-500/20",
                                  story.category === "EDUCATIONAL" && "bg-gradient-to-br from-emerald-500/20 to-teal-500/20",
                                )}>
                                  {icon}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                              <h3 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                {story.title}
                              </h3>
                              {story.summary && (
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{story.summary}</p>
                              )}
                              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground font-medium">
                                <span className="flex items-center gap-1 text-primary/80 font-semibold">{icon} {story.category || "Story"}</span>
                                {dur && <span>{dur}</span>}
                                {(story.ageRange?.min !== null || story.ageRange?.max !== null) && (
                                  <span>Ages {story.ageRange.min ?? "?"}-{story.ageRange.max ?? "?"}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Story detail panel */}
                  <div className="rounded-xl border border-border bg-card p-6 min-h-64">
                    {!selectedStorySummary ? (
                      <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-12 gap-3">
                        <span className="text-5xl">📖</span>
                        <p className="font-medium text-foreground">Select a story</p>
                        <p className="text-sm">Choose a story from the list to see details and generate narration.</p>
                      </div>
                    ) : detailLoading ? (
                      <div className="space-y-6">
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-10 w-32" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Title & meta */}
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="text-4xl leading-none mt-1">
                                {CATEGORY_ICONS[selectedStorySummary.category?.toUpperCase()] || CATEGORY_ICONS.UNCATEGORIZED}
                              </div>
                              <div>
                                <h2 className="text-2xl font-bold text-foreground">{selectedStorySummary.title}</h2>
                                {selectedStorySummary.author && (
                                  <p className="text-sm text-muted-foreground">By {selectedStorySummary.author}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-semibold">
                                {selectedStorySummary.category}
                              </Badge>
                              <Badge variant="outline" className="border-border bg-secondary text-secondary-foreground text-xs">
                                {selectedStorySummary.rights}
                              </Badge>
                            </div>
                          </div>
                          {selectedStorySummary.summary && (
                            <p className="text-sm text-muted-foreground leading-relaxed">{selectedStorySummary.summary}</p>
                          )}
                          {selectedStorySummary.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-2 text-xs">
                              {selectedStorySummary.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="border-border bg-secondary text-secondary-foreground">#{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Player controls */}
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="w-full rounded-md border border-border bg-card p-3 md:w-auto md:flex md:items-center md:gap-3">
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant={isPlayAll ? "secondary" : "default"} onClick={handlePlayAllToggle} disabled={playableSections.length === 0}>
                                {isPlayAll ? "Pause All" : "Play All"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={prevSection} disabled={playableSections.length === 0 || playIndex === 0}>
                                Prev
                              </Button>
                              <Button size="sm" variant="outline" onClick={nextSection} disabled={playableSections.length === 0 || playIndex >= playableSections.length - 1}>
                                Next
                              </Button>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground md:mt-0 md:ml-3">
                              {playableSections.length > 0 ? (
                                <span>Section {Math.min(playIndex + 1, playableSections.length)} / {playableSections.length}</span>
                              ) : (
                                <span>No generated audio yet</span>
                              )}
                            </div>
                            <audio ref={playAllAudioRef} className="mt-2 w-full md:hidden" controls preload="none" onEnded={nextSection} onError={nextSection} />
                            <div className="mt-2 md:mt-0 md:ml-3">
                              <Button size="sm" variant="outline" asChild disabled={!selectedSlug || !selectedVoiceProfile || playableSections.length === 0}>
                                <a href={`/api/stories/${selectedSlug}/download/full?voiceId=${encodeURIComponent(selectedVoiceProfile ?? "")}`}>
                                  Download All
                                </a>
                              </Button>
                            </div>
                          </div>

                          <Button
                            onClick={() => handleNarrate(false)}
                            disabled={!selectedVoiceProfile || voicesLoading || narrating || !!activeJob || (!!selectedVoice?.status && selectedVoice.status !== "ready")}
                          >
                            {narrating || activeJob ? "Generating narration..." : `Read with ${selectedVoice?.displayName ?? selectedVoice?.name ?? "selected voice"}`}
                          </Button>
                          <Button variant="outline" onClick={() => handleNarrate(true)} disabled={!selectedVoiceProfile || narrating || !!activeJob}>
                            Regenerate audio
                          </Button>
                          <Button variant="ghost" onClick={fetchStoryAudio} disabled={!selectedSlug || !selectedVoiceProfile || audioFetching}>
                            Refresh status
                          </Button>
                        </div>

                        {/* Job progress */}
                        {jobStatus && (
                          <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-foreground">Generating narration</span>
                              <Badge variant="outline" className={jobStateBadge(jobStatus.state)}>
                                {JOB_STATE_LABEL[jobStatus.state] ?? jobStatus.state}
                              </Badge>
                            </div>
                            <Progress value={jobStatus.progress ?? 0} className="h-3" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>
                                {jobStatus.totalSections && jobStatus.completedSections !== undefined
                                  ? `Section ${jobStatus.completedSections} of ${jobStatus.totalSections}`
                                  : `Progress: ${Math.round(jobStatus.progress ?? 0)}%`}
                              </span>
                              <span className="font-medium">
                                {formatSecondsRemaining(jobStatus.estimatedSecondsRemaining) ?? `${Math.round(jobStatus.progress ?? 0)}%`}
                              </span>
                            </div>
                            {jobStatus.failedReason && <p className="text-xs text-destructive">{jobStatus.failedReason}</p>}
                          </div>
                        )}

                        {/* Story content */}
                        {storyDetail?.content && (
                          <div className="rounded-lg border border-border bg-card p-4 text-sm whitespace-pre-wrap leading-relaxed">
                            {storyDetail.content}
                          </div>
                        )}

                        {/* Sections & audio */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-foreground">
                            {mergedSections.length > 1 ? "Sections & audio" : "Story Narration"}
                          </h3>
                          {mergedSections.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No story sections loaded. Try refreshing.</p>
                          ) : (
                            <div className="space-y-4">
                              {mergedSections.map((section, index) => {
                                const status = section.audio.status ?? "PENDING";
                                const badgeClass = STATUS_BADGE[status] ?? STATUS_BADGE.PENDING;
                                return (
                                  <div key={section.id} className="rounded-lg border border-border bg-card p-4 space-y-3 hover:border-border/80 transition-colors">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="flex items-center gap-2">
                                        {mergedSections.length > 1 && (
                                          <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                            {index + 1}
                                          </div>
                                        )}
                                        <div>
                                          {mergedSections.length > 1 && (
                                            <p className="text-sm font-semibold text-foreground">{section.title || `Section ${index + 1}`}</p>
                                          )}
                                          <p className="text-xs text-muted-foreground">{section.wordCount} words</p>
                                        </div>
                                      </div>
                                      <Badge variant="outline" className={cn(badgeClass, "text-xs font-semibold")}>{status}</Badge>
                                    </div>
                                    {section.text && (
                                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap border-l-2 border-primary/20 pl-3">
                                        {section.text}
                                      </p>
                                    )}
                                    {section.audio.audioUrl ? (
                                      <audio controls preload="none" className="w-full" src={section.audio.audioUrl} />
                                    ) : (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                                        Audio will appear here once generation completes.
                                      </div>
                                    )}
                                    {section.audio.audioUrl && (
                                      <div className="pt-1">
                                        <Button size="sm" variant="outline" asChild className="text-primary border-primary/40 hover:bg-primary/10">
                                          <a href={`/api/stories/${selectedStorySummary?.slug}/download/section/${section.id}?voiceId=${encodeURIComponent(selectedVoiceProfile ?? "")}`}>
                                            Download Audio
                                          </a>
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
