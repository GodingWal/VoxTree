import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { planLabel } from "@/lib/limits";
import type { Plan } from "@/types/database";
import { BrandLogo } from "@/components/brand-logo";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { ProfileDropdown } from "@/components/profile-dropdown";

export async function DashboardNav() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let plan: Plan = "free";
  let userName = "User";

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan, name")
      .eq("id", user.id)
      .single();

    if (profile) {
      plan = (profile.plan ?? "free") as Plan;
      userName = profile.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
    }
  }

  return (
    <header className="border-b bg-white/80 dark:bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <BrandLogo />
          
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/clones"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Clones
            </Link>
            <Link
              href="/browse"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Library
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center rounded-full bg-brand-green/10 text-brand-green px-3 py-1 text-xs font-semibold">
            {planLabel(plan)} Plan
          </span>
          <DarkModeToggle />
          {user && (
            <ProfileDropdown 
              userEmail={user.email || ""} 
              userName={userName} 
              plan={plan} 
            />
          )}
        </div>
      </div>
      
      {/* Mobile navigation bottom bar can be added or we can use a hamburger menu in the future. For now we just provide the links at the top. */}
      <nav className="md:hidden flex items-center justify-around border-t py-2 px-2 overflow-x-auto bg-background text-sm font-medium text-muted-foreground">
        <Link href="/dashboard" className="px-3 py-2 hover:text-foreground">Dashboard</Link>
        <Link href="/dashboard/clones" className="px-3 py-2 hover:text-foreground">Clones</Link>
        <Link href="/browse" className="px-3 py-2 hover:text-foreground">Library</Link>
      </nav>
    </header>
  );
}
