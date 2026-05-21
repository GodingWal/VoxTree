import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS, planLabel } from "@/lib/limits";
import type { Plan } from "@/types/database";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CreditCard, User as UserIcon, LogOut, ArrowUpRight } from "lucide-react";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan ?? "free") as Plan;
  
  const userName = profile?.name || user.user_metadata?.full_name || "Not provided";
  const userEmail = user.email;

  return (
    <main className="container py-8 space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-brand-charcoal dark:text-foreground">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account profile and billing preferences.
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <section className="rounded-xl border bg-white dark:bg-card overflow-hidden shadow-sm">
          <div className="border-b px-6 py-4 flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-brand-green" />
            <h2 className="text-lg font-semibold text-brand-charcoal dark:text-foreground">
              Profile
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-sm font-medium text-muted-foreground">Name</div>
              <div className="sm:col-span-2 text-sm text-foreground font-medium">{userName}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-sm font-medium text-muted-foreground">Email</div>
              <div className="sm:col-span-2 text-sm text-foreground font-medium">{userEmail}</div>
            </div>
            
            <div className="pt-4 mt-4 border-t">
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Billing Section */}
        <section className="rounded-xl border bg-white dark:bg-card overflow-hidden shadow-sm">
          <div className="border-b px-6 py-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-brand-green" />
            <h2 className="text-lg font-semibold text-brand-charcoal dark:text-foreground">
              Billing & Plan
            </h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Plan</p>
                <p className="text-lg font-bold text-foreground mt-1">
                  {planLabel(plan)}
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-brand-green/10 text-brand-green px-3 py-1 text-xs font-semibold">
                Active
              </span>
            </div>
            
            <div className="pt-4 border-t flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Want to change your plan?
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-green hover:underline"
              >
                View Plans
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
