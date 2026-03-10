export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-brand-cream/40 dark:bg-background">
      {/* Header skeleton */}
      <header className="border-b bg-white/80 dark:bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
            <div className="h-5 w-20 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-6 w-20 rounded-full bg-muted animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
      </header>

      <div className="lg:pl-60">
        <main className="container py-8 space-y-8">
          {/* Welcome skeleton */}
          <div className="space-y-2">
            <div className="h-8 w-64 rounded bg-muted animate-pulse" />
            <div className="h-4 w-48 rounded bg-muted animate-pulse" />
          </div>

          {/* Stats cards skeleton */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl bg-white dark:bg-card border p-5 flex items-center gap-4 shadow-sm"
              >
                <div className="h-11 w-11 rounded-xl bg-muted animate-pulse" />
                <div className="space-y-2">
                  <div className="h-6 w-8 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          {/* Voice progress skeleton */}
          <div className="space-y-2">
            <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            <div className="h-2 w-full rounded-full bg-muted animate-pulse" />
          </div>

          {/* Voice cards skeleton */}
          <div className="space-y-4">
            <div className="h-6 w-36 rounded bg-muted animate-pulse" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl bg-white dark:bg-card border p-5 space-y-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-14 rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-7 w-16 rounded-md bg-muted animate-pulse" />
                    <div className="h-7 w-14 rounded-md bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Clips skeleton */}
          <div className="space-y-4">
            <div className="h-6 w-40 rounded bg-muted animate-pulse" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl bg-white dark:bg-card border overflow-hidden shadow-sm"
                >
                  <div className="aspect-video bg-muted animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity feed skeleton */}
          <div className="space-y-4">
            <div className="h-6 w-36 rounded bg-muted animate-pulse" />
            <div className="rounded-xl bg-white dark:bg-card border shadow-sm divide-y">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 p-4">
                  <div className="h-7 w-7 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-48 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
