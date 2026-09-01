import { logger } from "./logger";

export async function sendOperationalAlert(event: string, fields: Record<string, unknown> = {}) {
  logger.error(event, fields);
  const endpoint = process.env.ALERT_WEBHOOK_URL;
  if (!endpoint) return;
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: "voxtree", event, fields, timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    logger.error("operational_alert_delivery_failed", { event, message: error instanceof Error ? error.message : "Unknown error" });
  }
}
