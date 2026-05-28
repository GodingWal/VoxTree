/**
 * Shared retry utility for external API calls.
 *
 * - Exponential backoff (default 1s, doubling) with jitter to avoid
 *   thundering-herd retries on a shared upstream outage.
 * - `shouldRetry` lets callers opt out of retries for terminal errors
 *   (e.g. 4xx from a paid API, where re-trying just burns money).
 * - Caps wait between attempts to avoid blocking the route forever.
 */
export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const maxDelayMs = opts.maxDelayMs ?? 15_000;
  const jitter = opts.jitter ?? true;
  const shouldRetry = opts.shouldRetry ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = attempt === attempts - 1;
      if (isLast || !shouldRetry(err, attempt)) break;

      let delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      if (jitter) delay = Math.floor(delay * (0.5 + Math.random() * 0.5));
      opts.onRetry?.(err, attempt, delay);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/**
 * Decide whether a fetch-Response-based failure is worth retrying. 408, 429,
 * and 5xx are transient; other 4xx are terminal (don't burn paid quota).
 */
export function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  return status >= 500 && status < 600;
}

export class HttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}
