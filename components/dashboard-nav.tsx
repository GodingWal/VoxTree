import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { planLabel } from "@/lib/limits";
import { isAdminEmail } from "@/lib/admin";
import type { Plan } from "@/types/database";
import { BrandLogo } from "@/components/brand-logo";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { ProfileDropdown } from "@/components/profile-dropdown";

export async function DashboardNav() {
  // The session user IS the users row under Auth.js (RLS: self-only).
  const user = await getCurrentUser();

  let plan: Plan = "free";
  let userName = "User";
  let userEmail = "";

  if (user) {
    userEmail = user.email ?? "";
    plan = (user.plan ?? "free") as Plan;
    userName = user.name || user.email?.split("@")[0] || "User";
  }

  const showAdmin = isAdminEmail(userEmail);

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/stories", label: "Stories" },
    { href: "/dashboard/clones", label: "Clones" },
    { href: "/dashboard/actor", label: "My Actor" },
    { href: "/browse", label: "Library" },
    { href: "/videos", label: "Videos" },
    ...(showAdmin ? [{ href: "/dashboard/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="border-b bg-white/80 dark:bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <BrandLogo />
          
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  link.label === "Admin"
                    ? "text-brand-coral hover:text-brand-coral/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
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
      
      {/* Mobile navigation */}
      <nav className="md:hidden flex items-center justify-around border-t py-2 px-2 overflow-x-auto bg-background text-sm font-medium text-muted-foreground">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-2 whitespace-nowrap ${
              link.label === "Admin"
                ? "text-brand-coral hover:text-brand-coral/80"
                : "hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
