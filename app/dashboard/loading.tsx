import { DashboardSkeleton } from "@/components/skeleton-cards";
import { BrandLogo } from "@/components/brand-logo";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-brand-cream/40 dark:bg-background">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between">
          <BrandLogo />
          <div className="flex items-center gap-3">
            <div className="h-8 w-20 rounded-full bg-muted skeleton-shimmer" />
            <div className="h-8 w-8 rounded-full bg-muted skeleton-shimmer" />
          </div>
        </div>
      </header>

      <main className="container py-8">
        <DashboardSkeleton />
      </main>
    </div>
  );
}
