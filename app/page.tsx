import Link from "next/link";
import { BookOpen, LockKeyhole, Mic2, ShieldCheck, Sparkles } from "lucide-react";
import { TwilightShell } from "@/components/twilight-layout";

const steps = [
  { icon: Mic2, title: "Record with permission", body: "A parent or guardian records an authorized family member and confirms who owns the voice." },
  { icon: Sparkles, title: "Create a private voice", body: "VoxTree prepares a family-only narrator after consent and account checks are complete." },
  { icon: BookOpen, title: "Choose a bedtime story", body: "Pick approved content and listen together from your private family library." },
];

export default function HomePage() {
  return (
    <TwilightShell>
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px 96px" }}>
        <section className="fadeUp" style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <div className="mono" style={{ color: "var(--lamp)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 24 }}>
            Family stories, in a familiar voice
          </div>
          <h1 className="serif" style={{ margin: 0, fontSize: "clamp(48px, 8vw, 94px)", lineHeight: 0.98, letterSpacing: "-0.035em" }}>
            Bedtime can sound like <span className="serif-italic" style={{ color: "var(--lamp)" }}>home.</span>
          </h1>
          <p style={{ maxWidth: 690, margin: "28px auto 0", color: "var(--paper-dim)", fontSize: 18, lineHeight: 1.65 }}>
            VoxTree lets families create a private, authorized voice narrator for children&apos;s stories. No public voice gallery, no advertising, and no fictional activity presented as your family&apos;s data.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 36 }}>
            <Link href="/signup" style={{ padding: "15px 24px", borderRadius: 999, background: "var(--lamp)", color: "var(--ink-0)", textDecoration: "none", fontWeight: 700 }}>Create a parent account</Link>
            <Link href="/login" style={{ padding: "15px 24px", borderRadius: 999, border: "1px solid var(--ink-3)", color: "var(--paper)", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
          </div>
        </section>

        <section aria-labelledby="how-it-works" style={{ marginTop: 96 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div className="mono" style={{ color: "var(--paper-mute)", fontSize: 10, letterSpacing: "0.13em", textTransform: "uppercase" }}>How it works</div>
            <h2 id="how-it-works" className="serif" style={{ fontSize: "clamp(34px, 5vw, 52px)", margin: "10px 0 0" }}>Three careful steps.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
            {steps.map(({ icon: Icon, title, body }, index) => (
              <article key={title} style={{ padding: 28, borderRadius: 22, background: "var(--ink-2)", border: "1px solid var(--ink-3)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                  <Icon size={24} color="var(--lamp)" aria-hidden="true" />
                  <span className="mono" style={{ color: "var(--paper-mute)", fontSize: 11 }}>0{index + 1}</span>
                </div>
                <h3 className="serif" style={{ margin: 0, fontSize: 26 }}>{title}</h3>
                <p style={{ margin: "12px 0 0", color: "var(--paper-dim)", lineHeight: 1.6 }}>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 72, padding: "32px clamp(22px, 5vw, 48px)", borderRadius: 24, border: "1px solid rgba(127,196,164,0.28)", background: "rgba(127,196,164,0.07)", display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start" }}>
          <ShieldCheck size={30} color="var(--moss)" aria-hidden="true" />
          <div>
            <h2 className="serif" style={{ margin: 0, fontSize: 30 }}>Privacy is part of the product.</h2>
            <p style={{ margin: "10px 0 0", color: "var(--paper-dim)", lineHeight: 1.65 }}>
              Voice creation is gated by signed consent and voice-owner authorization. Parents can review their consent record, export family data, revoke consent, and request permanent account deletion from settings.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 18, fontSize: 13 }}>
              <Link href="/privacy" style={{ color: "var(--lamp-soft)" }}>Read the privacy notice</Link>
              <Link href="/help" style={{ color: "var(--lamp-soft)" }}>Visit help</Link>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 72, textAlign: "center" }}>
          <LockKeyhole size={26} color="var(--lamp)" aria-hidden="true" />
          <h2 className="serif" style={{ fontSize: 38, margin: "14px 0 8px" }}>Ready to begin carefully?</h2>
          <p style={{ margin: "0 auto 24px", color: "var(--paper-dim)", maxWidth: 560 }}>Create a parent account, review consent, and add your first authorized family voice.</p>
          <Link href="/signup" style={{ display: "inline-block", padding: "14px 22px", borderRadius: 999, background: "var(--lamp)", color: "var(--ink-0)", textDecoration: "none", fontWeight: 700 }}>Get started</Link>
        </section>
      </main>
    </TwilightShell>
  );
}
