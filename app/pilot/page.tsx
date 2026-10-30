import { ShieldCheck } from "lucide-react";
import { TwilightShell } from "@/components/twilight-layout";
import { WaitlistForm } from "@/components/waitlist-form";

/**
 * Public founding-family pilot / waitlist page.
 *
 * Copy is the marketing kit v1, section 2, kept verbatim in wording and
 * honesty: pilot / waitlist framing only — VoxTree is not publicly
 * launched, there is no launch date, no testimonials or social proof,
 * and pilot pricing is presented only as the kit presents it.
 */

const steps = [
  {
    title: "Grandma (or Grandpa) says yes, and records",
    body: "The adult being featured does this themselves — a short voice recording and a few clear photos, plus a simple consent step in their own words. Nobody can sign up someone else to be cloned.",
  },
  {
    title: "We build their animated character",
    body: "Your loved one becomes a warm, cartoon-style character — clearly animated, not a fake “real” video — and their voice is matched to that character.",
  },
  {
    title: "Your child gets videos with a familiar face and voice",
    body: "Short lessons and songs for ages 2–8: letters, numbers, kindness, bedtime wind-downs — watched on a phone, tablet, or computer, whenever it fits your family's day.",
  },
];

const faqs = [
  {
    q: "Who can be cloned?",
    a: "Only an adult — 18 or older — and only themselves. A grandparent, parent, aunt, or uncle can choose to be featured. Children are never cloned, in face or voice, for any reason.",
  },
  {
    q: "How does consent work, and can I change my mind?",
    a: "Yes, at any time. The adult being featured gives their own explicit consent before anything is made, confirms they're an adult, and can revoke that consent later from their account or by contacting us. Revoking triggers deletion of their voice and likeness data — we'll confirm when it's done.",
  },
  {
    q: "What devices does my family need?",
    a: "Just what most families already have. Recording and consent happen in a web browser on a phone, tablet, or computer — no app to install for the pilot. Kids watch the finished videos in a browser on a phone, tablet, or computer too.",
  },
  {
    q: "When does it launch?",
    a: "Honestly: not yet, and we won't give you a fake date. We're building the pilot now with a small group of founding families, getting the experience right for grandparents first, and opening more spots as we're ready. Joining the waitlist is how you get a spot in line and hear first when pilot invitations go out.",
  },
  {
    q: "What will it cost?",
    a: "The founding-family pilot is $99 for the pilot year. After the pilot, we plan a Grandparent Gift Annual ($99–$149/year) and a $9.99/month library option, with additional finished videos available as credits rather than a big bundle. Waitlist signup costs nothing, and we'll confirm final pilot details by email before any charge.",
  },
  {
    q: "Is my voice data sold?",
    a: "No. Your voice and likeness are used to make your family's VoxTree videos — that's it. We don't sell voice or likeness data, we don't rent it to advertisers, and we don't use your family's recordings to train models for other companies.",
  },
  {
    q: "Is this meant to replace video calls or visits?",
    a: "No. Nothing replaces Grandma. VoxTree is for the in-between moments — a Tuesday bedtime, a long car ride, the week between calls — when a familiar face and voice teaching something small would mean a lot.",
  },
  {
    q: "What ages is it for?",
    a: "The lessons and songs are made for children ages 2–8. The adult account, purchase, and consent are always handled by an adult.",
  },
  {
    q: "What if Grandma isn't good with technology?",
    a: "That's exactly who we're designing for. Founding families get personal help with setup, the steps are short, and a family member can sit beside her (in person or on a call) while she gives consent and records. If she can't finish the setup comfortably, that's useful information for us — and there's no charge for trying during the pilot invitation stage.",
  },
];

const cardStyle: React.CSSProperties = {
  padding: 28,
  borderRadius: 22,
  background: "var(--ink-2)",
  border: "1px solid var(--ink-3)",
};

const bodyTextStyle: React.CSSProperties = {
  color: "var(--paper-dim)",
  lineHeight: 1.65,
};

export default function PilotPage() {
  return (
    <TwilightShell>
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px 96px" }}>
        {/* Hero */}
        <section className="fadeUp" style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <div
            className="mono"
            style={{ color: "var(--lamp)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 24 }}
          >
            Founding-family pilot
          </div>
          <h1 className="serif" style={{ margin: 0, fontSize: "clamp(44px, 7vw, 84px)", lineHeight: 1.02, letterSpacing: "-0.035em" }}>
            Grandma lives far away. She can still be there for{" "}
            <span className="serif-italic" style={{ color: "var(--lamp)" }}>story time.</span>
          </h1>
          <p style={{ maxWidth: 720, margin: "28px auto 0", color: "var(--paper-dim)", fontSize: 18, lineHeight: 1.65 }}>
            VoxTree turns a grandparent&apos;s own voice and likeness — with their full
            permission — into short, animated learning videos for grandchildren ages 2–8.
            We&apos;re inviting a small first group of founding families to help us build it
            well.
          </p>
          <div style={{ marginTop: 36 }}>
            <a
              href="#waitlist"
              style={{
                display: "inline-block",
                padding: "15px 24px",
                borderRadius: 999,
                background: "var(--lamp)",
                color: "var(--ink-0)",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Join the founding-family waitlist
            </a>
            <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--paper-mute)" }}>
              No payment today. We&apos;re starting small, on purpose.
            </p>
          </div>
          <div id="waitlist" style={{ maxWidth: 560, margin: "40px auto 0", scrollMarginTop: 96 }}>
            <WaitlistForm idPrefix="waitlist-hero" />
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how-it-works" style={{ marginTop: 96 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div className="mono" style={{ color: "var(--paper-mute)", fontSize: 10, letterSpacing: "0.13em", textTransform: "uppercase" }}>
              How it works
            </div>
            <h2 id="how-it-works" className="serif" style={{ fontSize: "clamp(34px, 5vw, 52px)", margin: "10px 0 0" }}>
              How it works — 3 steps
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
            {steps.map((step, index) => (
              <article key={step.title} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                  <span className="mono" style={{ color: "var(--paper-mute)", fontSize: 11 }}>
                    0{index + 1}
                  </span>
                </div>
                <h3 className="serif" style={{ margin: 0, fontSize: 26 }}>{step.title}</h3>
                <p style={{ margin: "12px 0 0", ...bodyTextStyle }}>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Trust & consent */}
        <section
          aria-labelledby="trust-consent"
          style={{
            marginTop: 72,
            padding: "32px clamp(22px, 5vw, 48px)",
            borderRadius: 24,
            border: "1px solid rgba(127,196,164,0.28)",
            background: "rgba(127,196,164,0.07)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start" }}>
            <ShieldCheck size={30} color="var(--moss)" aria-hidden="true" />
            <div>
              <h2 id="trust-consent" className="serif" style={{ margin: 0, fontSize: 30 }}>
                Trust &amp; consent — this comes before the fun, not after
              </h2>
              <p style={{ margin: "12px 0 0", fontWeight: 700, color: "var(--paper)" }}>
                Only adults. Only themselves. Only with permission.
              </p>
              <ul style={{ margin: "16px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 12, ...bodyTextStyle }}>
                <li>
                  <strong style={{ color: "var(--paper)" }}>Adults only, 18+.</strong> Children
                  are never cloned — not their face, not their voice. Children only watch.
                </li>
                <li>
                  <strong style={{ color: "var(--paper)" }}>You clone yourself.</strong> A parent
                  can&apos;t clone a grandparent, and a grandparent can&apos;t clone a parent.
                  The person featured gives consent themselves, and confirms they&apos;re an
                  adult.
                </li>
                <li>
                  <strong style={{ color: "var(--paper)" }}>You&apos;re in control.</strong>{" "}
                  Pause or revoke consent at any time. Revoking means your voice and likeness
                  are deleted — not just hidden.
                </li>
                <li>
                  <strong style={{ color: "var(--paper)" }}>Your voice is not for sale.</strong>{" "}
                  We don&apos;t sell your voice or likeness data, and we don&apos;t use your
                  family&apos;s recordings to train models for other companies. (See FAQ.)
                </li>
                <li>
                  <strong style={{ color: "var(--paper)" }}>Clearly animated, clearly labeled.</strong>{" "}
                  VoxTree characters are cartoon-style and videos are labeled as made with AI
                  and a family member&apos;s permission. We&apos;re not trying to fool a child —
                  or anyone — into thinking it&apos;s a live recording.
                </li>
                <li>
                  <strong style={{ color: "var(--paper)" }}>Parents approve what kids watch.</strong>{" "}
                  Videos are made from our own authored lessons and stories — a child never
                  chats openly with an AI character.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Pilot offer */}
        <section aria-labelledby="pilot-offer" style={{ marginTop: 72, ...cardStyle, padding: "32px clamp(22px, 5vw, 48px)" }}>
          <div className="mono" style={{ color: "var(--paper-mute)", fontSize: 10, letterSpacing: "0.13em", textTransform: "uppercase" }}>
            Pilot offer — founding families
          </div>
          <h2 id="pilot-offer" className="serif" style={{ fontSize: "clamp(30px, 4vw, 42px)", margin: "10px 0 0" }}>
            We&apos;re starting with 20–50 families, and the first spots are for long-distance
            grandparents.
          </h2>
          <p style={{ margin: "16px 0 0", ...bodyTextStyle }}>Founding families get:</p>
          <ul style={{ margin: "12px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10, ...bodyTextStyle }}>
            <li>A personal, hands-on setup — we help Grandma or Grandpa through recording and consent, step by step</li>
            <li>Their animated character and voice, built for the pilot library of lessons and songs</li>
            <li>A founding-family price that stays theirs while they&apos;re in the pilot</li>
            <li>
              A direct line to us: what worked, what confused your parent, what your child
              actually rewatched — founding families shape the product
            </li>
          </ul>
          <p style={{ margin: "20px 0 0", ...bodyTextStyle }}>
            <strong style={{ color: "var(--paper)" }}>Pilot pricing:</strong> $99 for the
            founding-family pilot year.
          </p>
          <p style={{ margin: "12px 0 0", ...bodyTextStyle }}>
            <strong style={{ color: "var(--paper)" }}>After the pilot, our planned gift option:</strong>{" "}
            a Grandparent Gift Annual in the $99–$149/year range — one family member can buy
            it for a grandparent — plus a smaller $9.99/month library option for families who
            want to start month-to-month.
          </p>
          <p style={{ margin: "16px 0 0", fontStyle: "italic", ...bodyTextStyle }}>
            Joining the waitlist is not a purchase. We&apos;ll email you before anything is
            charged, with the final details to confirm.
          </p>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq" style={{ marginTop: 96 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div className="mono" style={{ color: "var(--paper-mute)", fontSize: 10, letterSpacing: "0.13em", textTransform: "uppercase" }}>
              Questions
            </div>
            <h2 id="faq" className="serif" style={{ fontSize: "clamp(34px, 5vw, 52px)", margin: "10px 0 0" }}>
              FAQ
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 860, margin: "0 auto" }}>
            {faqs.map((faq) => (
              <article key={faq.q} style={cardStyle}>
                <h3 className="serif" style={{ margin: 0, fontSize: 24 }}>{faq.q}</h3>
                <p style={{ margin: "10px 0 0", ...bodyTextStyle }}>{faq.a}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Closing waitlist capture */}
        <section style={{ marginTop: 96, textAlign: "center" }}>
          <h2 className="serif" style={{ fontSize: 38, margin: "0 0 8px" }}>
            Join the founding-family waitlist
          </h2>
          <p style={{ margin: "0 auto", color: "var(--paper-dim)", maxWidth: 560, lineHeight: 1.65 }}>
            We&apos;re inviting a small first group of founding families to help us build it
            well.
          </p>
          <div style={{ maxWidth: 560, margin: "32px auto 0" }}>
            <WaitlistForm idPrefix="waitlist-closing" />
          </div>
        </section>
      </main>
    </TwilightShell>
  );
}
