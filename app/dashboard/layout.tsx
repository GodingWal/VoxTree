import { DashboardNav } from "@/components/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
