import { TwilightShell } from "@/components/twilight-layout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TwilightShell>
      {children}
    </TwilightShell>
  );
}
