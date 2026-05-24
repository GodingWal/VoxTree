import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS, planLabel } from "@/lib/limits";
import type { Plan } from "@/types/database";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Section } from "@/components/twilight-ui";

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
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 24px" }}>
      <div className="fadeUp" style={{ marginBottom: 40 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
          Profile Settings
        </div>
        <h1 className="serif" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0, letterSpacing: "-0.02em" }}>
          Profile & Billing
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56, maxWidth: 800 }}>
        <Section eyebrow="Account" title={<>Your <span className="serif-italic">Profile</span></>}>
          <div style={{
            background: "var(--ink-2)", border: "1px solid var(--ink-3)",
            borderRadius: 20, padding: 32,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 16, marginBottom: 24 }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.1em", paddingTop: 4 }}>
                Name
              </div>
              <div style={{ fontSize: 16, color: "var(--paper)" }}>
                {userName}
              </div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 16, marginBottom: 32 }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.1em", paddingTop: 4 }}>
                Email
              </div>
              <div style={{ fontSize: 16, color: "var(--paper)" }}>
                {userEmail}
              </div>
            </div>
            
            <div style={{ paddingTop: 24, borderTop: "1px solid var(--ink-3)" }}>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  style={{
                    background: "none", border: 0, padding: 0,
                    color: "var(--rose)", fontSize: 14, fontWeight: 500,
                    cursor: "pointer"
                  }}
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </Section>

        <Section eyebrow="Subscription" title={<>Billing & <span className="serif-italic">Plan</span></>}>
          <div style={{
            background: "var(--ink-2)", border: "1px solid var(--ink-3)",
            borderRadius: 20, padding: 32,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
              <div>
                <div className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                  Current Plan
                </div>
                <div className="serif" style={{ fontSize: 32, color: "var(--lamp-soft)", lineHeight: 1 }}>
                  {planLabel(plan)}
                </div>
              </div>
              <div style={{
                padding: "6px 14px",
                background: "rgba(127,196,164,0.1)", color: "var(--moss)",
                border: "1px solid rgba(127,196,164,0.2)", borderRadius: 99,
                fontSize: 12, fontWeight: 600,
              }}>
                Active
              </div>
            </div>
            
            <div style={{ paddingTop: 24, borderTop: "1px solid var(--ink-3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, color: "var(--paper-dim)" }}>
                Want to change your plan?
              </div>
              <Link href="/pricing" style={{
                padding: "10px 18px",
                background: "var(--lamp)", color: "var(--ink-0)",
                border: 0, borderRadius: 99, textDecoration: "none",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
                View Plans →
              </Link>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
