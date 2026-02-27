import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { VideoCard } from "@/components/VideoCard";
import { QuickActionCard } from "@/components/QuickActionCard";
import { CollaboratorCard } from "@/components/CollaboratorCard";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AdBanner } from "@/components/AdBanner";
import { UsageSummary } from "@/components/UsageSummary";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ["/api/videos"],
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
  });

  const { data: families } = useQuery({
    queryKey: ["/api/families"],
  });

  const { data: voiceProfiles } = useQuery({
    queryKey: ["/api/voice-profiles"],
  });

  const { data: activities } = useQuery({
    queryKey: ["/api/families", Array.isArray(families) ? families[0]?.id : null, "activities"],
    enabled: Boolean(families && Array.isArray(families) && families[0]?.id),
  });

  // Onboarding checklist state
  const hasVoice = Array.isArray(voiceProfiles) && voiceProfiles.length > 0;
  const hasVideos = Array.isArray(videos) && videos.length > 0;
  const onboardingSteps = [
    {
      label: "Clone a voice",
      description: "Record 5 voice samples to create your first AI voice",
      done: hasVoice,
      href: "/voice-cloning",
      icon: "fas fa-microphone",
    },
    {
      label: "Pick a template",
      description: "Browse our video template library and choose one",
      done: hasVideos,
      href: "/create",
      icon: "fas fa-film",
    },
    {
      label: "Create your first video",
      description: "Combine your voice clone with a template to make a video",
      done: hasVideos,
      href: "/create",
      icon: "fas fa-video",
    },
  ];
  const completedSteps = onboardingSteps.filter((s) => s.done).length;
  const showOnboarding = completedSteps < onboardingSteps.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      {/* Ad Banner for Free Users */}
      <div className="pt-16">
        <AdBanner placement="banner" />
      </div>

      {/* Hero Section */}
      <main className="pt-4">
        <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-secondary py-12 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center animate-fade-in">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
                <span className="gradient-text">Create Magical</span>
                <br />
                <span className="text-foreground">Family Videos</span>
              </h2>
              <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                Transform your family memories with AI-powered voice cloning, collaborative editing, and stunning video creation tools designed for families.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/create">
                  <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-start-creating">
                    <i className="fas fa-play mr-2"></i>
                    Start Creating
                  </Button>
                </Link>
                <Link href="/stories">
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto" data-testid="button-browse-stories">
                    <i className="fas fa-book mr-2"></i>
                    Browse Stories
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          <div className="absolute top-20 right-10 w-32 h-32 bg-primary/20 rounded-full blur-xl animate-float hidden sm:block"></div>
          <div className="absolute bottom-20 left-10 w-24 h-24 bg-accent/20 rounded-full blur-xl animate-float hidden sm:block" style={{animationDelay: '1s'}}></div>
        </section>
      </main>

      {/* Getting Started Checklist */}
      {showOnboarding && (
        <section className="py-8 bg-card border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">Getting Started</h3>
                <p className="text-sm text-muted-foreground">Complete these steps to create your first video</p>
              </div>
              <span className="text-sm font-medium text-primary">{completedSteps}/{onboardingSteps.length} done</span>
            </div>
            <Progress value={(completedSteps / onboardingSteps.length) * 100} className="h-2 mb-6" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {onboardingSteps.map((step, idx) => (
                <Link key={idx} href={step.href}>
                  <Card className={`cursor-pointer transition-all hover:shadow-md ${step.done ? 'opacity-60' : 'hover:border-primary'}`}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? 'bg-primary/20' : 'bg-muted'}`}>
                        {step.done ? (
                          <i className="fas fa-check text-primary"></i>
                        ) : (
                          <i className={`${step.icon} text-muted-foreground`}></i>
                        )}
                      </div>
                      <div>
                        <p className={`font-medium text-sm ${step.done ? 'line-through text-muted-foreground' : ''}`}>
                          Step {idx + 1}: {step.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="py-12 sm:py-16 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <QuickActionCard
              icon="fas fa-microphone"
              title="Record Voice"
              description="Capture family voices for AI cloning"
              href="/voice-cloning"
              iconColor="text-primary"
              bgColor="bg-primary/20"
            />
            <QuickActionCard
              icon="fas fa-robot"
              title="AI Clone"
              description="Create AI voice duplicates instantly"
              href="/voice-cloning"
              iconColor="text-accent"
              bgColor="bg-accent/20"
            />
            <QuickActionCard
              icon="fas fa-video"
              title="Create Video"
              description="Generate family stories with AI"
              href="/create"
              iconColor="text-primary"
              bgColor="bg-primary/20"
            />
            <QuickActionCard
              icon="fas fa-users"
              title="Collaborate"
              description="Work together in real-time"
              href="/videos"
              iconColor="text-accent"
              bgColor="bg-accent/20"
            />
          </div>
        </div>
      </section>

      {/* Video Library */}
      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Your Family Library</h2>
              <p className="text-muted-foreground">Recent videos and ongoing projects</p>
            </div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6 w-full lg:w-auto">
              <UsageSummary compact className="hidden lg:flex" />
              <Link href="/create" className="lg:self-end">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-new-project">
                  <i className="fas fa-plus mr-2"></i>
                  New Project
                </Button>
              </Link>
            </div>
          </div>

          {/* Mobile Usage Summary */}
          <div className="lg:hidden mb-6">
            <UsageSummary />
          </div>

          {videosLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-video w-full" />
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : Array.isArray(videos) && videos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(videos || []).slice(0, 6).map((video: any) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border" data-testid="text-no-videos">
              <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-film text-4xl text-primary/60"></i>
              </div>
              <h3 className="text-xl font-semibold mb-2">Your video library is empty</h3>
              <p className="text-muted-foreground mb-2 max-w-md mx-auto">
                Your finished videos will appear here — cinematic family stories narrated in your own voice, ready to share and treasure.
              </p>
              <p className="text-sm text-muted-foreground mb-6">Pick a template and create your first one in minutes.</p>
              <Link href="/create">
                <Button size="lg" data-testid="button-create-first-video">
                  <i className="fas fa-plus mr-2"></i>
                  Create Your First Video
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Real-time Collaboration */}
      {Array.isArray(activities) && activities.length > 0 && (
        <section className="py-16 bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Recent Family Activity</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">See what your family members have been creating and sharing.</p>
            </div>

            <div className="bg-card rounded-xl p-8 shadow-lg">
              <div className="space-y-3">
                {(activities || []).slice(0, 5).map((activity: any, index: number) => (
                  <div key={activity.id} className="flex items-center space-x-3 text-sm">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                      <i className={`fas ${getActivityIcon(activity.action)} text-primary text-xs`}></i>
                    </div>
                    <div className="flex-1">
                      <span className="font-medium">{activity.user?.firstName || 'Someone'}</span> {getActivityText(activity.action)} <span className="text-primary">{activity.details?.title || 'a project'}</span>
                    </div>
                    <span className="text-muted-foreground">{formatTimeAgo(activity.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function getActivityIcon(action: string): string {
  switch (action) {
    case 'create_video': return 'fa-video';
    case 'update_video': return 'fa-edit';
    case 'join_collaboration': return 'fa-users';
    case 'create_voice_profile': return 'fa-microphone';
    default: return 'fa-activity';
  }
}

function getActivityText(action: string): string {
  switch (action) {
    case 'create_video': return 'created a new video';
    case 'update_video': return 'updated';
    case 'join_collaboration': return 'started collaborating on';
    case 'create_voice_profile': return 'created a voice profile for';
    default: return 'worked on';
  }
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / (1000 * 60));

  if (Number.isNaN(diffInMinutes) || diffInMinutes < 1) {
    return 'just now';
  }

  const pluralize = (value: number, unit: string) =>
    `${value} ${unit}${value === 1 ? '' : 's'} ago`;

  if (diffInMinutes < 60) {
    return pluralize(diffInMinutes, 'minute');
  }

  const hours = Math.floor(diffInMinutes / 60);
  if (hours < 24) {
    return pluralize(hours, 'hour');
  }

  const days = Math.floor(diffInMinutes / 1440);
  if (days < 7) {
    return pluralize(days, 'day');
  }

  const weeks = Math.floor(diffInMinutes / (1440 * 7));
  if (weeks < 5) {
    return pluralize(weeks, 'week');
  }

  const months = Math.floor(diffInMinutes / (1440 * 30));
  if (months < 12) {
    return pluralize(months, 'month');
  }

  const years = Math.floor(diffInMinutes / (1440 * 365));
  return pluralize(Math.max(years, 1), 'year');
}
