import { logger } from "./logger";

export async function sendTransactionalEmail(input: { to: string; template: string; data?: Record<string, unknown> }) {
  const endpoint = process.env.TRANSACTIONAL_EMAIL_WEBHOOK_URL;
  if (!endpoint) {
    logger.warn("transactional_email_not_configured", { template: input.template });
    return false;
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Transactional email webhook failed: ${response.status}`);
  return true;
}

/**
 * Direct email sending (subject + body), provider-pluggable.
 *
 * Provider: Resend's HTTPS API (https://api.resend.com/emails) when
 * RESEND_API_KEY is set. When no provider is configured this is a
 * logged no-op — it returns { sent: false } instead of throwing, so
 * callers on user-facing request paths (e.g. the public waitlist
 * signup) can fire-and-forget it: a mail problem must never fail the
 * action the user actually asked for. Delivery failures after a
 * provider IS configured are likewise reported in the result, not
 * thrown.
 */
export interface SendEmailResult {
  sent: boolean;
  /** Resend message id when the provider accepted the email. */
  id?: string;
  /** Machine-readable reason when sent is false. */
  reason?: "not_configured" | "provider_error";
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("email_not_configured_noop", { to: input.to, subject: input.subject });
    return { sent: false, reason: "not_configured" };
  }

  const from = process.env.EMAIL_FROM || "VoxTree <hello@vox-tree.com>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      logger.error("email_provider_error", {
        to: input.to,
        subject: input.subject,
        status: response.status,
      });
      return { sent: false, reason: "provider_error" };
    }
    const body = (await response.json().catch(() => null)) as { id?: string } | null;
    return { sent: true, id: body?.id };
  } catch (error) {
    logger.error("email_send_failed", {
      to: input.to,
      subject: input.subject,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { sent: false, reason: "provider_error" };
  }
}

/**
 * Waitlist confirmation email — Email 1 ("Welcome") from the VoxTree
 * marketing kit v1 (voxtree-marketing-kit-v1.md §6), adapted in one
 * place: the kit's "$99 for the pilot year" line predates the Oct 29,
 * 2026 pilot-price decision, so it now states the decided pilot price
 * ($29.99/month). Everything else — especially the honesty framing
 * (not launched yet, pilot invitations in order, nothing charged
 * before the details are shared, adults consent for themselves and
 * children are never cloned) — is the kit copy verbatim in substance.
 */
export function waitlistConfirmationEmail(name: string): { subject: string; text: string } {
  const firstName = name.trim().split(/\s+/)[0] || "there";
  return {
    subject: "You're on the VoxTree list 🌳 Here's what happens next",
    text: [
      `Hi ${firstName},`,
      "",
      "Thank you for joining the VoxTree founding-family waitlist. It means a lot — you're early, and early families are the ones who shape this.",
      "",
      "Here's the honest picture of where things stand:",
      "",
      "VoxTree isn't launched yet. We're building a small pilot for 20–50 families, starting with long-distance grandparents. When pilot spots open, waitlist families hear first, in order, with the full details — including the pilot price ($29.99/month) — before anything is charged. If the details don't work for your family, you can simply pass. No hard feelings, no sales calls.",
      "",
      "What happens next:",
      "1. You'll get one short email from us explaining what a participating grandparent needs to prepare (it's simple — a short voice recording and a few photos).",
      "2. When your pilot invitation is ready, we'll email you personally with the start date for your group and the consent steps, explained in plain language.",
      "3. If you join the pilot, we set up your family's account together, with help — especially for grandparents.",
      "",
      "One thing we'd love to know, if you're willing: who's the grandparent, and how far away are the grandkids? Just reply to this email. Real answers from real families are how we're deciding what to build first.",
      "",
      "Thank you again,",
      "The VoxTree family",
      "",
      "P.S. Our founding rule, so you hear it from us first: we only ever feature adults who consent for themselves. Children are never cloned. Ever.",
    ].join("\n"),
  };
}
