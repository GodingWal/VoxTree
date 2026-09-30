import * as Sentry from "@sentry/nextjs";
import { logger } from "./logger";

export async function sendOperationalAlert(event: string, fields: Record<string, unknown> = {}) {
  logger.error(event, fields);

  // Mirror every operational alert into Sentry for correlation and paging.
  try {
    Sentry.captureException(new Error(event), {
      extra: fields,
      tags: { alert_event: event, service: "voxtree" },
      level: "error",
    });
  } catch {
    // Sentry not configured or failed — do not block alert delivery.
  }

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
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("operational_alert_delivery_failed", { event, message });
    try {
      Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: { event, message },
        tags: { alert_event: "operational_alert_delivery_failed" },
        level: "warning",
      });
    } catch {
      // ignore Sentry failure
    }
  }
}
