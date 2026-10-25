import { DashboardSkeleton } from "@/components/skeleton-cards";

export default function DashboardLoading() {
  return (
    <main className="container py-8">
      <DashboardSkeleton />
    </main>
  );
}
