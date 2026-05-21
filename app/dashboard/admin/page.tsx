import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Users,
  BookOpen,
  Mic,
  BarChart3,
} from "lucide-react";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = await isAdmin(user.email);
  if (!admin) redirect("/dashboard");

  // Fetch aggregate stats
  const { count: userCount } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  const { count: voiceCount } = await supabase
    .from("family_voices")
    .select("*", { count: "exact", head: true });

  const { count: contentCount } = await supabase
    .from("content_library")
    .select("*", { count: "exact", head: true });

  const { count: clipCount } = await supabase
    .from("generated_clips")
    .select("*", { count: "exact", head: true });

  const stats = [
    { label: "Total Users", value: userCount ?? 0, icon: Users, color: "bg-brand-green/10 text-brand-green" },
    { label: "Voice Clones", value: voiceCount ?? 0, icon: Mic, color: "bg-brand-coral/10 text-brand-coral" },
    { label: "Content Items", value: contentCount ?? 0, icon: BookOpen, color: "bg-brand-sage/20 text-brand-green" },
    { label: "Generated Clips", value: clipCount ?? 0, icon: BarChart3, color: "bg-brand-gold/10 text-brand-gold" },
  ];

  return (
    <main className="container max-w-5xl py-8 sm:py-12 space-y-8">
      <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-xl bg-brand-coral/10 p-2.5">
          <Shield className="h-5 w-5 text-brand-coral" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-charcoal dark:text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Platform overview and management
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="group rounded-xl bg-white dark:bg-card border p-5 flex items-center gap-4 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all"
          >
            <div className={`rounded-xl p-3 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-charcoal dark:text-foreground">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border bg-white dark:bg-card p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        <h2 className="text-lg font-semibold text-brand-charcoal dark:text-foreground">
          Quick Actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/browse"
            className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted/50 hover:-translate-y-0.5 transition-all"
          >
            <div className="rounded-lg bg-brand-sage/20 p-2">
              <BookOpen className="h-4 w-4 text-brand-green" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-charcoal dark:text-foreground">
                Manage Content Library
              </p>
              <p className="text-xs text-muted-foreground">Add, edit, or remove stories</p>
            </div>
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted/50 hover:-translate-y-0.5 transition-all"
          >
            <div className="rounded-lg bg-brand-gold/10 p-2">
              <Users className="h-4 w-4 text-brand-gold" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-charcoal dark:text-foreground">
                User Management
              </p>
              <p className="text-xs text-muted-foreground">View users and subscriptions</p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
