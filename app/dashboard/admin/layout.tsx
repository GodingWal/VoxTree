import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, Users, BookOpen, BarChart3 } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = await isAdmin(user.email);
  if (!admin) redirect("/dashboard");

  const navItems = [
    { href: "/dashboard/admin", label: "Overview", icon: Shield },
    { href: "/dashboard/admin/users", label: "Users", icon: Users },
    { href: "/dashboard/admin/content", label: "Content", icon: BookOpen },
    { href: "/dashboard/admin/analytics", label: "KPIs", icon: BarChart3 },
  ];

  return (
    <div className="container max-w-6xl py-8 sm:py-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-coral/10 p-2.5">
            <Shield className="h-6 w-6 text-brand-coral" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-brand-charcoal dark:text-foreground">
              Admin Console
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage platform, users, and content
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div>{children}</div>
    </div>
  );
}
