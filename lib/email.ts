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
