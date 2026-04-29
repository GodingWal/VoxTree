export function SkeletonVoiceCard() {
  return (
    <div className="rounded-xl bg-white dark:bg-card border p-5 space-y-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted skeleton-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 rounded bg-muted skeleton-shimmer" />
          <div className="h-3 w-16 rounded bg-muted skeleton-shimmer" />
        </div>
      </div>
      <div className="h-9 w-full rounded-lg bg-muted skeleton-shimmer" />
    </div>
  );
}

export function SkeletonStatsCard() {
  return (
    <div className="rounded-xl bg-white dark:bg-card border p-5 flex items-center gap-4 shadow-sm">
      <div className="h-11 w-11 rounded-xl bg-muted skeleton-shimmer" />
      <div className="space-y-2">
        <div className="h-6 w-8 rounded bg-muted skeleton-shimmer" />
        <div className="h-3 w-20 rounded bg-muted skeleton-shimmer" />
      </div>
    </div>
  );
}

export function SkeletonClipCard() {
  return (
    <div className="rounded-xl bg-white dark:bg-card border overflow-hidden shadow-sm">
      <div className="aspect-video bg-muted skeleton-shimmer" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted skeleton-shimmer" />
        <div className="h-3 w-1/2 rounded bg-muted skeleton-shimmer" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 rounded bg-muted skeleton-shimmer" />
        <div className="h-4 w-48 rounded bg-muted skeleton-shimmer" />
      </div>

      {/* Stats skeleton */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SkeletonStatsCard />
        <SkeletonStatsCard />
        <SkeletonStatsCard />
      </div>

      {/* Voice cards skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-32 rounded bg-muted skeleton-shimmer" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonVoiceCard />
          <SkeletonVoiceCard />
        </div>
      </div>

      {/* Clips skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-40 rounded bg-muted skeleton-shimmer" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonClipCard />
          <SkeletonClipCard />
          <SkeletonClipCard />
        </div>
      </div>
    </div>
  );
}
