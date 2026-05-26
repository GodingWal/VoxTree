import { createClient } from "@/lib/supabase/server";
import { TwilightShell } from "@/components/twilight-layout";
import { ShieldCheck, Calendar, FileText, CheckCircle2, UserCheck } from "lucide-react";
import Link from "next/link";
import { ConsentFormClient } from "./consent-form-client";

export const metadata = {
  title: "Parental Consent | VoxTree",
  description: "Provide verified parental consent for children's voice cloning and visual avatar generation.",
};

export default async function ConsentPage() {
  const supabase = createClient();
  
  // Get active session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let consentVerified = false;
  let userName = "Parent/Guardian";

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("consent_verified, name")
      .eq("id", user.id)
      .single();

    consentVerified = !!profile?.consent_verified;
    userName = profile?.name || user.email?.split("@")[0] || "Parent/Guardian";
  }

  return (
    <TwilightShell>
      {/* Background radial glow */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 600, height: 600,
        background: "radial-gradient(circle, rgba(127,196,164,0.06) 0%, transparent 60%)",
        pointerEvents: "none", zIndex: -1
      }} />

      <div style={{ maxWidth: 800, margin: "64px auto 96px", padding: "0 24px" }}>
        
        {/* Page Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }} className="fadeUp">
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
            Regulatory Compliance
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(36px, 5vw, 56px)", margin: "0 0 16px 0", color: "var(--paper)", letterSpacing: "-0.02em" }}>
            Parental <span className="serif-italic">Consent</span> Center
          </h1>
          <p style={{ color: "var(--paper-dim)", fontSize: 15, maxWidth: 540, margin: "0 auto", lineHeight: 1.5 }}>
            To create family voice clones and visual Pixar characters, COPPA regulations require verified consent from a parent or legal guardian.
          </p>
        </div>

        {consentVerified ? (
          /* CONSENT IS VERIFIED */
          <div style={{
            background: "var(--ink-2)", border: "1px solid var(--moss)",
            borderRadius: 28, padding: "56px 40px", textAlign: "center",
            boxShadow: "0 20px 40px rgba(127,196,164,0.04)"
          }} className="fadeUp">
            <div style={{
              width: 80, height: 80, borderRadius: "50%", background: "rgba(127,196,164,0.1)",
              color: "var(--moss)", display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 24px"
            }}>
              <CheckCircle2 size={40} />
            </div>

            <h2 className="serif" style={{ fontSize: 32, color: "var(--paper)", margin: "0 0 12px 0" }}>
              Consent Status: <span style={{ color: "var(--moss)" }}>Verified</span>
            </h2>
            
            <p style={{ color: "var(--paper-dim)", fontSize: 15, maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.6 }}>
              Thank you, <strong style={{ color: "var(--paper)" }}>{userName}</strong>. You have successfully verified your parental consent. Your family is fully authorized to capture snapshots and clone voices.
            </p>

            <div style={{
              maxWidth: 480, margin: "0 auto", background: "var(--ink-1)", border: "1px solid var(--ink-3)",
              borderRadius: 16, padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
              textAlign: "left"
            }}>
              <div>
                <div className="mono" style={{ fontSize: 9, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Authorized Signatory
                </div>
                <div style={{ fontSize: 14, color: "var(--paper)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <UserCheck size={14} style={{ color: "var(--moss)" }} />
                  {userName}
                </div>
              </div>
              
              <div>
                <div className="mono" style={{ fontSize: 9, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Verification Date
                </div>
                <div style={{ fontSize: 14, color: "var(--paper)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <Calendar size={14} style={{ color: "var(--lamp-soft)" }} />
                  Active (Authorized)
                </div>
              </div>
            </div>

            <div style={{ marginTop: 40 }}>
              <Link href="/dashboard/family" style={{
                padding: "14px 28px", background: "var(--lamp)", color: "var(--ink-0)",
                border: "none", borderRadius: 99, fontWeight: 600, fontSize: 14,
                textDecoration: "none", cursor: "pointer", display: "inline-block"
              }}>
                Return to Family Tree →
              </Link>
            </div>
          </div>
        ) : !user ? (
          /* USER NOT LOGGED IN */
          <div style={{
            background: "var(--ink-2)", border: "1px solid var(--ink-3)",
            borderRadius: 24, padding: 48, textAlign: "center"
          }} className="fadeUp">
            <div style={{
              width: 64, height: 64, borderRadius: 16, background: "rgba(244,184,96,0.1)",
              color: "var(--lamp)", display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px"
            }}>
              <FileText size={32} />
            </div>

            <h3 className="serif" style={{ fontSize: 24, color: "var(--paper)", margin: "0 0 12px 0" }}>
              Authentication Required
            </h3>
            
            <p style={{ color: "var(--paper-dim)", fontSize: 14, lineHeight: 1.6, maxWidth: 480, margin: "0 auto 32px" }}>
              Please log in to your parent account to review and sign the voice cloning and visual capturing consent form.
            </p>

            <Link href="/login" style={{
              padding: "14px 32px", background: "var(--lamp)", color: "var(--ink-0)",
              border: "none", borderRadius: 99, fontWeight: 600, fontSize: 14,
              textDecoration: "none", cursor: "pointer", display: "inline-block"
            }}>
              Log In to Verify Consent
            </Link>
          </div>
        ) : (
          /* USER IS LOGGED IN BUT CONSENT NOT VERIFIED */
          <ConsentFormClient parentName={userName} />
        )}

      </div>
    </TwilightShell>
  );
}
