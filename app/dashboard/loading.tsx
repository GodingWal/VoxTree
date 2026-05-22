import { DashboardSkeleton } from "@/components/skeleton-cards";
import { BrandLogo } from "@/components/brand-logo";

export default function DashboardLoading() {
  return (
    <main className="container py-8">
      <DashboardSkeleton />
    </main>
  );
}
