import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
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
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import Seo, { BASE_URL } from "@/components/Seo";
import { cn } from "@/lib/utils";

type StoryCategory =
  | "BEDTIME"
  | "CLASSIC"
  | "FAIRYTALE"
  | "ADVENTURE"
  | "EDUCATIONAL"
  | "CUSTOM"
  | string;

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
  ageRange: {
    min: number | null;
    max: number | null;
  };
  durationMin: number | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
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

type StoryAudioStatus = "PENDING" | "QUEUED" | "PROCESSING" | "COMPLETE" | "ERROR" | string;

interface StoryAudioEntry {
  status: StoryAudioStatus;
  audioUrl: string | null;
  durationSec: number | null;
  checksum: string | null;
  transcript: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

interface StoryDetailResponse extends StorySummary {
  content?: string;
  sections: StorySection[];
}

interface StoryAudioSection extends StorySection {
  audio: StoryAudioEntry;
}

interface StoryAudioResponse {
  story: StorySummary;
  voice: {
    id: string;
    displayName?: string;
  };
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
  story: {
    id: string;
    slug: string;
    title: string;
  };
  voice: {
    id: string;
    displayName?: string;
  };
  sections?: StoryAudioSection[];
}

interface StoryJobStatus {
  id: string;
  state: string;
  progress: number;
  totalSections?: number;
  completedSections?: number;
  currentSection?: number;
  estimatedSecondsRemaining?: number | null;
  attempts: number;
  data: {
    storyId: string;
    voiceId: string;
  };
  failedReason: string | null;
  result: unknown;
  timestamp: {
    createdAt: string | null;
    finishedAt: string | null;
  };
}

interface ActiveJob {
  jobId: string;
  slug: string;
  voiceId: string;
}

const EMPTY_AUDIO_ENTRY: StoryAudioEntry = {
  status: "PENDING",
  audioUrl: null,
  durationSec: null,
  checksum: null,
  transcript: null,
  error: null,
  metadata: {},
  startedAt: null,
  completedAt: null,
  updatedAt: null,
};

const STATUS_BADGE_CLASS: Record<StoryAudioStatus, string> = {
  PENDING: "bg-slate-800 text-slate-200 border border-slate-600",
  QUEUED: "bg-amber-500/20 text-amber-200 border border-amber-500/40",
  PROCESSING: "bg-sky-500/20 text-sky-100 border border-sky-500/50",
  COMPLETE: "bg-emerald-500/20 text-emerald-100 border border-emerald-500/50",
  ERROR: "bg-rose-500/20 text-rose-100 border border-rose-500/40",
};

const JOB_STATE_LABEL: Record<string, string> = {
  waiting: "Waiting in queue",
  delayed: "Delayed",
  active: "Generating audio",
  completed: "Completed",
  failed: "Failed",
  paused: "Paused",
  stuck: "Stuck",
  waitingChildren: "Waiting on subtasks",
};

const jobStateBadge = (state: string) => {
  switch (state) {
    case "completed":
      return "bg-emerald-500/20 text-emerald-100 border border-emerald-500/40";
    case "active":
      return "bg-sky-500/20 text-sky-100 border border-sky-500/40";
    case "failed":
      return "bg-rose-500/20 text-rose-100 border border-rose-500/40";
    case "waiting":
    case "waitingChildren":
      return "bg-amber-500/20 text-amber-100 border border-amber-500/40";
    default:
      return "bg-slate-800 text-slate-200 border border-slate-600";
  }
};

const formatMinutes = (minutes: number | null | undefined) => {
  if (!minutes || Number.isNaN(minutes)) {
    return null;
  }
  if (minutes < 1) {
    return "<1 minute";
  }
  if (minutes < 60) {
    return `${Math.round(minutes)} minute${minutes >= 1.5 ? "s" : ""}`;
  }
  const hours = minutes / 60;
  if (hours < 3) {
    return `${hours.toFixed(1)} hours`;
  }
  return `${Math.round(hours)} hours`;
};

const formatSecondsRemaining = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return null;
  }
  if (seconds < 5) {
    return "Almost done...";
  }
  if (seconds < 60) {
    return `About ${Math.ceil(seconds / 5) * 5} seconds remaining`;
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes === 1) {
    return "About 1 minute remaining";
  }
  return `About ${minutes} minutes remaining`;
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

export default function Stories() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedVoiceProfile, setSelectedVoiceProfile] = useState<string | null>(
    null
  );
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [jobStatus, setJobStatus] = useState<StoryJobStatus | null>(null);
  const [isPlayAll, setIsPlayAll] = useState(false);
  const [playIndex, setPlayIndex] = useState<number>(0);
  const playAllAudioRef = useRef<HTMLAudioElement | null>(null);

  const {
    data: storiesResponse,
    isLoading: storiesLoading,
    isError: storiesError,
  } = useQuery<StoryListResponse>({
    queryKey: ["story-catalog"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/stories");
      return response.json();
    },
  });

  const stories = storiesResponse?.stories ?? [];

  const {
    data: voiceProfiles = [],
    isLoading: voicesLoading,
  } = useQuery<VoiceProfile[]>({
    queryKey: ["voice-profiles"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/voice-profiles");
      return response.json();
    },
  });

  useEffect(() => {
    if (!selectedVoiceProfile && voiceProfiles.length > 0) {
      setSelectedVoiceProfile(voiceProfiles[0].id);
    }
  }, [voiceProfiles, selectedVoiceProfile]);

  useEffect(() => {
    if (!selectedSlug && stories.length > 0) {
      setSelectedSlug(stories[0].slug);
    }
  }, [stories, selectedSlug]);

  const selectedVoice = useMemo(
    () => voiceProfiles.find((profile) => profile.id === selectedVoiceProfile) ?? null,
    [voiceProfiles, selectedVoiceProfile]
  );

  const categories = useMemo(
    () =>
      Array.from(new Set(stories.map((story) => story.category || "UNCATEGORIZED"))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [stories]
  );

  const filteredStories = useMemo(() => {
    if (categoryFilter === "ALL") {
      return stories;
    }
    return stories.filter(
      (story) =>
        (story.category || "UNCATEGORIZED").toUpperCase() === categoryFilter.toUpperCase()
    );
  }, [stories, categoryFilter]);

  const selectedStorySummary = useMemo(
    () => stories.find((story) => story.slug === selectedSlug) ?? null,
    [stories, selectedSlug]
  );

  const {
    data: storyDetail,
    isLoading: detailLoading,
  } = useQuery<StoryDetailResponse>({
    queryKey: ["story-detail", selectedSlug],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/stories/${selectedSlug}`);
      return response.json();
    },
    enabled: Boolean(selectedSlug),
  });

  const {
    data: storyAudioData,
    isFetching: audioFetching,
    refetch: refetchStoryAudio,
  } = useQuery<StoryAudioResponse>({
    queryKey: ["story-audio", selectedSlug, selectedVoiceProfile],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/stories/${selectedSlug}/audio?voiceId=${encodeURIComponent(
          selectedVoiceProfile ?? ""
        )}`
      );
      return response.json();
    },
    enabled: Boolean(selectedSlug && selectedVoiceProfile),
  });

  useEffect(() => {
    if (!activeJob) {
      setJobStatus(null);
      return;
    }

    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await apiRequest("GET", `/api/jobs/${activeJob.jobId}`);
        const data: StoryJobStatus = await res.json();
        if (isCancelled) {
          return;
        }
        setJobStatus(data);
        
        if (data.state === "active") {
          queryClient.invalidateQueries({
            queryKey: ["story-audio", activeJob.slug, activeJob.voiceId],
          });
        }

        if (data.state === "completed") {
          toast({
            title: "Story narration ready",
            description: "All sections have completed synthesis.",
          });
          queryClient.invalidateQueries({
            queryKey: ["story-audio", activeJob.slug, activeJob.voiceId],
          });
          setActiveJob(null);
          return;
        }

        if (data.state === "failed") {
          toast({
            title: "Narration failed",
            description: data.failedReason ?? "We could not complete the narration job.",
            variant: "destructive",
          });
          setActiveJob(null);
          return;
        }

        timeoutId = setTimeout(poll, 3000);
      } catch (error: any) {
        if (isCancelled) {
          return;
        }
        console.error("Failed to poll story job", error);
        timeoutId = setTimeout(poll, 5000);
      }
    };

    poll();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeJob, queryClient]);

  useEffect(() => {
    if (categoryFilter !== "ALL" && filteredStories.length === 0 && stories.length > 0) {
      setCategoryFilter("ALL");
    }
  }, [filteredStories.length, stories.length, categoryFilter]);

  const mergedSections: StoryAudioSection[] = useMemo(() => {
    const baseSections: (StorySection & { audio?: StoryAudioEntry })[] =
      storyDetail?.sections ??
      storyAudioData?.sections ??
      [];

    const audioLookup = new Map(
      (storyAudioData?.sections ?? []).map((section) => [section.id, section.audio])
    );

    if (storyAudioData?.sections && storyDetail?.sections) {
      // ensure we have consistent ordering from detail response
      return storyDetail.sections.map((section) => ({
        ...section,
        audio: audioLookup.get(section.id) ?? EMPTY_AUDIO_ENTRY,
      }));
    }

    return baseSections.map((section) => ({
      ...section,
      audio: section.audio ?? audioLookup.get(section.id) ?? EMPTY_AUDIO_ENTRY,
    }));
  }, [storyDetail, storyAudioData]);

  const playableSections = useMemo(
    () => mergedSections.filter((s) => Boolean(s.audio?.audioUrl)),
    [mergedSections]
  );

  // Reset "Play All" when story or voice changes
  useEffect(() => {
    setIsPlayAll(false);
    setPlayIndex(0);
    if (playAllAudioRef.current) {
      playAllAudioRef.current.pause();
      playAllAudioRef.current.src = "";
    }
  }, [selectedSlug, selectedVoiceProfile]);

  // When Play All is toggled on, (re)start from current playIndex
  useEffect(() => {
    const audioEl = playAllAudioRef.current;
    if (!audioEl) return;
    if (!isPlayAll) return;
    const current = playableSections[playIndex];
    if (!current?.audio?.audioUrl) return;
    if (audioEl.src !== new URL(current.audio.audioUrl, window.location.origin).toString()) {
      audioEl.src = current.audio.audioUrl;
    }
    audioEl.play().catch(() => {
      // Autoplay might be blocked; keep controls visible for manual play
    });
  }, [isPlayAll, playIndex, playableSections]);

  const nextSection = () => {
    setPlayIndex((idx) => {
      const next = idx + 1;
      if (next >= playableSections.length) {
        setIsPlayAll(false);
        return idx;
      }
      return next;
    });
  };

  const prevSection = () => {
    setPlayIndex((idx) => Math.max(0, idx - 1));
  };

  const handlePlayAllToggle = () => {
    if (playableSections.length === 0) return;
    if (!isPlayAll) {
      // Start from first incomplete or current index
      setPlayIndex((idx) => (idx < playableSections.length ? idx : 0));
      setIsPlayAll(true);
    } else {
      setIsPlayAll(false);
      playAllAudioRef.current?.pause();
    }
  };

  const requestNarration = useMutation<ReadResponse, unknown, { force?: boolean }>({
    mutationFn: async ({ force }) => {
      if (!selectedSlug || !selectedVoiceProfile) {
        throw new Error("Select a story and voice profile first.");
      }
      const response = await apiRequest("POST", `/api/stories/${selectedSlug}/read`, {
        voiceId: selectedVoiceProfile,
        force,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.ready) {
        toast({
          title: "Narration ready",
          description: "We found completed sections for this story and voice.",
        });
        queryClient.invalidateQueries({
          queryKey: ["story-audio", data.story?.slug, selectedVoiceProfile],
        });
        setActiveJob(null);
        setJobStatus(null);
        refetchStoryAudio();
        return;
      }

      if (!data.jobId) {
        toast({
          title: "Narration requested",
          description: "We queued this story for processing.",
        });
        return;
      }

      toast({
        title: "Narration queued",
        description:
          "We'll keep you posted as each section completes. You can stay on this page or come back later.",
      });
      setActiveJob({
        jobId: data.jobId,
        slug: data.story.slug,
        voiceId: selectedVoiceProfile!,
      });
      setJobStatus((prev) => ({
        id: data.jobId!,
        state: data.state ?? prev?.state ?? "waiting",
        progress: data.progress ?? prev?.progress ?? 0,
        attempts: prev?.attempts ?? 0,
        data: {
          storyId: data.story.id,
          voiceId: selectedVoiceProfile!,
        },
        failedReason: null,
        result: null,
        timestamp: prev?.timestamp ?? {
          createdAt: new Date().toISOString(),
          finishedAt: null,
        },
      }));
    },
    onError: (error) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as Error).message)
          : "We couldn't start narration. Please try again.";

      toast({
        title: "Narration failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleNarrate = (force?: boolean) => {
    if (!selectedVoiceProfile) {
      toast({
        title: "Select a voice",
        description: "Choose a voice profile before generating narration.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedVoice || (selectedVoice.status && selectedVoice.status !== "ready")) {
      toast({
        title: "Voice not ready",
        description: "Pick a ready voice profile before generating narration.",
        variant: "destructive",
      });
      return;
    }

    requestNarration.mutate({ force });
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What are VoxTree Stories?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Stories are curated, age-appropriate scripts that families can personalize with AI voices and turn into narrated experiences inside VoxTree.",
        },
      },
      {
        "@type": "Question",
        name: "How do I generate narration for a story?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Choose your favorite voice profile, select a story, and click request narration. VoxTree will create an AI-read performance and notify you when it is ready.",
        },
      },
      {
        "@type": "Question",
        name: "Can I switch between different AI voices?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Absolutely. You can assign any approved family voice profile to a story and regenerate narration whenever you need a new performance.",
        },
      },
    ],
  } as const;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="Discover AI-narrated family stories"
        description="Browse curated VoxTree stories, pair them with cloned family voices, and request immersive narrations in seconds."
        canonical={`${BASE_URL}/stories`}
        openGraph={{
          type: "website",
          url: `${BASE_URL}/stories`,
          title: "Discover AI-narrated family stories | VoxTree",
          description:
            "Browse curated VoxTree stories, pair them with cloned family voices, and request immersive narrations in seconds.",
        }}
        twitter={{
          title: "Discover AI-narrated family stories | VoxTree",
          description:
            "Explore ready-made VoxTree story scripts and instantly generate narrated performances with your family's AI voices.",
        }}
        jsonLd={faqSchema}
      />
      <Navigation />
      <div className="container mx-auto px-4 pt-24 pb-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 border border-primary/20">
            <span>📖</span>
            Story Library
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Family Stories
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base leading-relaxed">
            Discover curated stories for every member of the family. Pick a voice
            you love and generate immersive narration with a single click.
          </p>
        </div>

        <Card className="bg-card border border-border shadow-sm">
          <CardHeader className="md:flex md:items-start md:justify-between gap-6 border-b border-border/50 pb-6">
            <div className="md:flex-1">
              <div className="flex items-center gap-2 mb-1">
                <i className="fas fa-microphone text-primary text-sm" />
                <CardTitle className="text-foreground">Narration Voice</CardTitle>
              </div>
              <CardDescription>
                Choose a voice profile to use when generating story narrations.
              </CardDescription>
            </div>
            <div className="md:w-64 lg:w-72 mt-4 md:mt-0 flex flex-col gap-4">
              <div>
                {voicesLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : voiceProfiles.length > 0 ? (
                  <Select
                    value={selectedVoiceProfile ?? undefined}
                    onValueChange={setSelectedVoiceProfile}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {voiceProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {(profile.displayName ?? profile.name) ||
                            profile.name}
                          {profile.status && profile.status !== "ready"
                            ? ` · ${profile.status}`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No voice profiles found. Visit the Voice Cloning studio to
                    create one.
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {storiesLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : storiesError ? (
              <div className="text-center text-muted-foreground">
                We couldn't load stories right now. Please try again later.
              </div>
            ) : stories.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-book-open text-3xl text-primary/60"></i>
                </div>
                <h3 className="text-xl font-semibold mb-2">No stories available yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                  Stories are narrated tales your family can listen to using AI-cloned voices. New stories are being added regularly.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a href="/voice-cloning">
                    <Button variant="outline">
                      <i className="fas fa-microphone mr-2"></i>
                      Clone a Voice First
                    </Button>
                  </a>
                  <a href="/create">
                    <Button>
                      <i className="fas fa-video mr-2"></i>
                      Create a Video Instead
                    </Button>
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("ALL")}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                        categoryFilter === "ALL"
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      All ({storiesResponse?.total ?? stories.length})
                    </button>
                    {categories.map((category) => {
                      const icon = CATEGORY_ICONS[category?.toUpperCase()] || CATEGORY_ICONS.UNCATEGORIZED;
                      const count = stories.filter(s => (s.category || "UNCATEGORIZED").toUpperCase() === category.toUpperCase()).length;
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setCategoryFilter(category)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5",
                            categoryFilter === category
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                          )}
                        >
                          <span>{icon}</span>
                          {category} ({count})
                        </button>
                      );
                    })}
                  </div>
                  {selectedStorySummary && selectedVoiceProfile && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-accent/20 text-accent border border-accent/40 text-xs">
                        <i className="fas fa-headphones mr-1.5" />
                        {selectedStorySummary.title} · {(selectedVoice?.displayName ?? selectedVoice?.name) || "Voice"}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-[2fr,3fr]">
                  <div className="space-y-3">
                    {filteredStories.map((story) => {
                      const durationLabel = formatMinutes(story.durationMin);
                      const isSelected = story.slug === selectedSlug;
                      const icon = CATEGORY_ICONS[story.category?.toUpperCase()] || CATEGORY_ICONS.UNCATEGORIZED;

                      return (
                        <button
                          type="button"
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
                                <img
                                  src={story.coverUrl}
                                  alt={story.title}
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <div className={cn(
                                "flex h-full w-full items-center justify-center text-3xl",
                                story.category === "BEDTIME" && "bg-gradient-to-br from-indigo-500/20 to-purple-500/20",
                                story.category === "CLASSIC" && "bg-gradient-to-br from-amber-500/20 to-orange-500/20",
                                story.category === "FAIRYTALE" && "bg-gradient-to-br from-pink-500/20 to-rose-500/20",
                                story.category === "ADVENTURE" && "bg-gradient-to-br from-sky-500/20 to-cyan-500/20",
                                story.category === "EDUCATIONAL" && "bg-gradient-to-br from-emerald-500/20 to-teal-500/20",
                                story.category === "CUSTOM" && "bg-gradient-to-br from-primary/20 to-accent/20",
                                !["BEDTIME","CLASSIC","FAIRYTALE","ADVENTURE","EDUCATIONAL","CUSTOM"].includes(story.category || "") && "bg-gradient-to-br from-primary/10 to-secondary/10",
                                story.coverUrl ? "hidden" : ""
                              )}>
                                {icon}
                              </div>
                            </div>

                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                  {story.title}
                                </h3>
                              </div>

                              {story.summary && (
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                  {story.summary}
                                </p>
                              )}

                              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground font-medium">
                                <span className="flex items-center gap-1 text-primary/80 font-semibold">
                                  {icon} {story.category || "Story"}
                                </span>
                                {durationLabel && (
                                  <span className="flex items-center gap-1">
                                    <i className="far fa-clock" /> {durationLabel}
                                  </span>
                                )}
                                {(story.ageRange?.min !== null || story.ageRange?.max !== null) && (
                                  <span className="flex items-center gap-1">
                                    <i className="fas fa-child" /> Ages {story.ageRange.min ?? "?"}-{story.ageRange.max ?? "?"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-border bg-card p-6 min-h-64">
                    {!selectedStorySummary ? (
                      <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-12 gap-3">
                        <span className="text-5xl">📖</span>
                        <p className="font-medium text-foreground">Select a story</p>
                        <p className="text-sm">Choose a story from the list to see details and generate narration.</p>
                      </div>
                    ) : detailLoading ? (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <Skeleton className="h-8 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <div className="flex flex-wrap gap-2">
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-6 w-24" />
                          </div>
                          <Skeleton className="h-16 w-full" />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Skeleton className="h-10 w-32" />
                          <Skeleton className="h-10 w-32" />
                          <Skeleton className="h-10 w-24" />
                        </div>
                        <div className="space-y-4">
                          <Skeleton className="h-6 w-1/3" />
                          <Skeleton className="h-24 w-full" />
                          <Skeleton className="h-24 w-full" />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="text-4xl leading-none mt-1">
                                {CATEGORY_ICONS[selectedStorySummary.category?.toUpperCase()] || CATEGORY_ICONS.UNCATEGORIZED}
                              </div>
                              <div>
                                <h2 className="text-2xl font-bold text-foreground">
                                  {selectedStorySummary.title}
                                </h2>
                                {selectedStorySummary.author && (
                                  <p className="text-sm text-muted-foreground">
                                    By {selectedStorySummary.author}
                                  </p>
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
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {selectedStorySummary.summary}
                            </p>
                          )}
                          {selectedStorySummary.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 text-xs">
                              {selectedStorySummary.tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="border-border bg-secondary text-secondary-foreground"
                                >
                                  #{tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {/* Full Story Player */}
                          <div className="w-full rounded-md border border-border bg-card p-3 md:w-auto md:flex md:items-center md:gap-3">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={isPlayAll ? "secondary" : "default"}
                                onClick={handlePlayAllToggle}
                                disabled={playableSections.length === 0}
                              >
                                {isPlayAll ? (
                                  <span className="flex items-center gap-2">
                                    <i className="fas fa-pause" /> Pause All
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2">
                                    <i className="fas fa-play" /> Play All
                                  </span>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={prevSection}
                                disabled={playableSections.length === 0 || playIndex === 0}
                              >
                                <i className="fas fa-backward" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={nextSection}
                                disabled={playableSections.length === 0 || playIndex >= playableSections.length - 1}
                              >
                                <i className="fas fa-forward" />
                              </Button>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground md:mt-0 md:ml-3">
                              {playableSections.length > 0 ? (
                                <span>
                                  Section {Math.min(playIndex + 1, playableSections.length)} / {playableSections.length}
                                </span>
                              ) : (
                                <span>No generated audio yet</span>
                              )}
                            </div>
                            {/* Hidden but usable audio element for Play All */}
                            <audio
                              ref={playAllAudioRef}
                              className="mt-2 w-full md:hidden"
                              controls
                              preload="none"
                              onEnded={nextSection}
                              onError={nextSection}
                            />
                            {/* Download full story */}
                            <div className="mt-2 md:mt-0 md:ml-3">
                              <Button
                                size="sm"
                                variant="outline"
                                asChild
                                disabled={!selectedSlug || !selectedVoiceProfile || playableSections.length === 0}
                              >
                                <a
                                  href={`/api/stories/${selectedSlug}/download/full?voiceId=${encodeURIComponent(
                                    selectedVoiceProfile ?? ''
                                  )}`}
                                >
                                  <i className="fas fa-download mr-2" /> Download All
                                </a>
                              </Button>
                            </div>
                          </div>

                          <Button
                            onClick={() => handleNarrate(false)}
                            className="bg-gradient-to-r from-brand-green via-primary to-brand-gold hover:from-brand-green/90 hover:via-primary/90 hover:to-brand-gold/90 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                            disabled={Boolean(
                              !selectedVoiceProfile ||
                              voicesLoading ||
                              requestNarration.isPending ||
                              Boolean(activeJob) ||
                              (!!selectedVoice?.status && selectedVoice.status !== "ready")
                            )}
                          >
                            {requestNarration.isPending || activeJob ? (
                              <span className="flex items-center gap-2">
                                <i className="fas fa-circle-notch animate-spin" />
                                Generating narration...
                              </span>
                            ) : (
                              <span className="flex items-center gap-2 font-semibold">
                                <i className="fas fa-magic" />
                                Read with{" "}
                                {(selectedVoice?.displayName ?? selectedVoice?.name) ||
                                  "selected voice"}
                              </span>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleNarrate(true)}
                            disabled={
                              !selectedVoiceProfile ||
                              voicesLoading ||
                              requestNarration.isPending ||
                              Boolean(activeJob)
                            }
                          >
                            Regenerate audio
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              if (selectedSlug && selectedVoiceProfile) {
                                refetchStoryAudio();
                              }
                            }}
                            disabled={!selectedSlug || !selectedVoiceProfile || audioFetching}
                          >
                            Refresh status
                          </Button>
                        </div>

                        {jobStatus && (
                          <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-foreground">
                                Generating narration
                              </span>
                              <Badge
                                variant="outline"
                                className={jobStateBadge(jobStatus.state)}
                              >
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
                                {formatSecondsRemaining(jobStatus.estimatedSecondsRemaining) ??
                                  `${Math.round(jobStatus.progress ?? 0)}%`}
                              </span>
                            </div>
                            {jobStatus.failedReason && (
                              <p className="text-xs text-destructive">
                                {jobStatus.failedReason}
                              </p>
                            )}
                          </div>
                        )}

                        <>
                          {storyDetail?.content && (
                            <div className="rounded-lg border border-border bg-card p-4 text-sm whitespace-pre-wrap leading-relaxed">
                              {storyDetail.content}
                            </div>
                          )}

                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-foreground">
                              {mergedSections.length > 1 ? "Sections & audio" : "Story Narration"}
                            </h3>
                            {mergedSections.length === 0 ? (
                              <p className="text-sm text-slate-300">
                                We could not load story sections yet. Try refreshing the page.
                              </p>
                            ) : (
                              <div className="space-y-4">
                                {mergedSections.map((section, index) => {
                                  const status =
                                    section.audio.status ?? "PENDING";
                                  const badgeClass =
                                    STATUS_BADGE_CLASS[status] ??
                                    STATUS_BADGE_CLASS.PENDING;
                                  return (
                                    <div
                                      key={section.id}
                                      className="rounded-lg border border-border bg-card p-4 space-y-3 hover:border-border/80 transition-colors"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                          {mergedSections.length > 1 && (
                                            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                              {index + 1}
                                            </div>
                                          )}
                                          <div>
                                            {mergedSections.length > 1 && (
                                              <p className="text-sm font-semibold text-foreground">
                                                {section.title || `Section ${index + 1}`}
                                              </p>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                              {section.wordCount} words
                                            </p>
                                          </div>
                                        </div>
                                        <Badge variant="outline" className={cn(badgeClass, "text-xs font-semibold")}>
                                          {status}
                                        </Badge>
                                      </div>
                                      {section.text && (
                                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap border-l-2 border-primary/20 pl-3">
                                          {section.text}
                                        </p>
                                      )}
                                      {section.audio.audioUrl ? (
                                        <audio
                                          controls
                                          preload="none"
                                          className="w-full"
                                          src={section.audio.audioUrl}
                                        />
                                      ) : (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                                          <i className="fas fa-clock" />
                                          Audio will appear here once generation completes.
                                        </div>
                                      )}
                                      {section.audio.audioUrl && (
                                        <div className="pt-1">
                                          <Button size="sm" variant="outline" asChild className="text-primary border-primary/40 hover:bg-primary/10">
                                            <a
                                              href={`/api/stories/${selectedStorySummary?.slug}/download/section/${section.id}?voiceId=${encodeURIComponent(
                                                selectedVoiceProfile ?? ''
                                              )}`}
                                            >
                                              <i className="fas fa-download mr-2" /> Download Audio
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
                        </>
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
