import Link from "next/link";
import { TwilightShell } from "@/components/twilight-layout";
import { Section } from "@/components/twilight-ui";
import { ShieldCheck, Lock, EyeOff, KeyRound } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | VoxTree",
  description: "Learn how VoxTree handles family voice, child profile, and generated story data.",
};

export default function PrivacyPage() {
  return (
    <TwilightShell>
      {/* Background glow effects */}
      <div style={{
        position: "fixed", top: 100, left: "5%", width: 400, height: 400,
        background: "radial-gradient(circle, rgba(232,133,108,0.06) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: -1
      }} />
      <div style={{
        position: "fixed", bottom: 100, right: "5%", width: 500, height: 500,
        background: "radial-gradient(circle, rgba(244,184,96,0.06) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: -1
      }} />

      <div style={{ maxWidth: 960, margin: "64px auto 96px", padding: "0 24px" }}>
        
        {/* Page Header */}
        <div style={{ marginBottom: 56 }} className="fadeUp">
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
            Data Protection
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(36px, 6vw, 64px)", margin: "0 0 16px 0", color: "var(--paper)", letterSpacing: "-0.02em" }}>
            Privacy <span className="serif-italic">Matters</span>
          </h1>
          <p style={{ color: "var(--paper-dim)", fontSize: 16, maxWidth: 640, lineHeight: 1.6 }}>
            VoxTree is built on the absolute trust of families. We treat voice prints, visual profiles, and children&apos;s details with the highest possible level of security and respect.
          </p>
        </div>

        {/* Pillars Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 64 }} className="fadeUp">
          <PillarCard icon={<ShieldCheck size={28} />} title="100% Owned By You" desc="Your voice clones and visual avatars belong to your family alone. We never rent or sell them." />
          <PillarCard icon={<Lock size={28} />} title="Private Storage" desc="Uploads are stored in private cloud storage and accessed through short-lived signed links." />
          <PillarCard icon={<EyeOff size={28} />} title="Limited Purpose" desc="Family media is processed to provide requested VoxTree features and is not offered in a public voice gallery." />
        </div>

        {/* Policy Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 56 }} className="fadeUp">
          <Section eyebrow="SAFETY" title={<>Compliance & <span className="serif-italic">Children</span></>}>
            <div style={{
              background: "var(--ink-2)", border: "1px solid var(--ink-3)",
              borderRadius: 20, padding: 32, color: "var(--paper-dim)", fontSize: 15, lineHeight: 1.7
            }}>
              <p style={{ marginTop: 0 }}>
                Because VoxTree is used by families with children, the product includes safeguards intended to support applicable child-privacy requirements. Final legal applicability and launch geography require qualified counsel review.
              </p>
              <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                <li>
                  <strong style={{ color: "var(--paper)" }}>Recorded Parental Consent:</strong> Voice creation requires a signed, versioned consent record and a separate voice-owner authorization confirmation.
                </li>
                <li>
                  <strong style={{ color: "var(--paper)" }}>No Ad-Tracking:</strong> VoxTree contains zero commercial advertisements. We never track children&apos;s behavior for targeting or analytics.
                </li>
                <li>
                  <strong style={{ color: "var(--paper)" }}>Data Controls:</strong> Settings provide data export, consent revocation, and permanent account deletion. Failed deletion attempts are recorded for operational follow-up.
                </li>
              </ul>
            </div>
          </Section>

          <Section eyebrow="NARRATION DATA" title={<>How We Process <span className="serif-italic">Voice & Video</span></>}>
            <div style={{
              background: "var(--ink-2)", border: "1px solid var(--ink-3)",
              borderRadius: 20, padding: 32, color: "var(--paper-dim)", fontSize: 15, lineHeight: 1.7
            }}>
              <p style={{ marginTop: 0 }}>
                When you initiate a clone setup:
              </p>
              <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                <li>
                  The browser captures a short 1-minute audio recording and optional 5-second video frame.
                </li>
                <li>
                  These inputs are split server-side: the audio is fed to private ElevenLabs API synthesis pipelines, and the visual snapshots are converted to stylized avatars.
                </li>
                <li>
                  Completed video/audio files are generated on demand and stored in private cloud storage buckets protected by unique authorization tokens.
                </li>
              </ol>
              <p style={{ marginBottom: 0, marginTop: 20 }}>
                Need to review or delete your data? Visit the <Link href="/dashboard/settings" style={{ color: "var(--lamp)", textDecoration: "none", fontWeight: 600 }}>Billing & Profile Settings</Link> page or contact our data officer.
              </p>
            </div>
          </Section>

          <Section eyebrow="CONTACT" title={<>Privacy <span className="serif-italic">Questions</span></>}>
            <div style={{
              background: "var(--ink-2)", border: "1px solid var(--ink-3)",
              borderRadius: 20, padding: 32, color: "var(--paper-dim)", fontSize: 15, lineHeight: 1.7
            }}>
              <p style={{ marginTop: 0, marginBottom: 0 }}>
                If you have questions about child consent, RVC cloning storage, or need to request a data backup archive, please contact our team at <strong style={{ color: "var(--paper)" }}>privacy@voxtree.ai</strong>. We will reply to all inquiries within 48 hours.
              </p>
            </div>
          </Section>
        </div>

      </div>
    </TwilightShell>
  );
}

function PillarCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{
      background: "var(--ink-2)", border: "1px solid var(--ink-3)",
      borderRadius: 18, padding: 24, display: "flex", flexDirection: "column", gap: 14
    }}>
      <div style={{ color: "var(--lamp)", display: "flex", alignItems: "center" }}>
        {icon}
      </div>
      <h3 className="serif" style={{ fontSize: 18, color: "var(--paper)", margin: 0 }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: "var(--paper-dim)", margin: 0, lineHeight: 1.5 }}>
        {desc}
      </p>
    </div>
  );
}
