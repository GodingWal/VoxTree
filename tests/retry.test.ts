import { describe, it, expect, vi } from "vitest";
import { withRetry, isRetryableStatus, HttpError } from "../lib/retry";

describe("withRetry", () => {
  it("returns the value on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries up to the attempt cap on failure", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { attempts: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws when all attempts fail", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      withRetry(fn, { attempts: 2, baseDelayMs: 1 })
    ).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(400, "bad"));
    const shouldRetry = vi.fn((err) =>
      err instanceof HttpError ? isRetryableStatus(err.status) : true
    );
    await expect(
      withRetry(fn, { attempts: 5, baseDelayMs: 1, shouldRetry })
    ).rejects.toBeInstanceOf(HttpError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry between attempts", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValue("y");
    const onRetry = vi.fn();
    await withRetry(fn, { attempts: 3, baseDelayMs: 1, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("isRetryableStatus", () => {
  it("treats 408, 429, and 5xx as retryable", () => {
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(599)).toBe(true);
  });

  it("treats 2xx, 3xx, and most 4xx as terminal", () => {
    expect(isRetryableStatus(200)).toBe(false);
    expect(isRetryableStatus(301)).toBe(false);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});
