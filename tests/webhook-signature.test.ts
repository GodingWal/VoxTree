import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyReplicateWebhook } from "../lib/webhook-signature";

function sign(secret: string, id: string, ts: string, body: string): string {
  const secretBytes = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");
  return createHmac("sha256", secretBytes)
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
}

function makeHeaders(rec: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(rec)) h.set(k, v);
  return h;
}

describe("verifyReplicateWebhook", () => {
  const secret = "whsec_" + Buffer.from("test-secret-bytes").toString("base64");
  const body = '{"id":"abc","status":"succeeded","version":"v1"}';
  const id = "msg_123";

  it("accepts a correctly signed webhook", () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = sign(secret, id, ts, body);
    const result = verifyReplicateWebhook({
      rawBody: body,
      secret,
      headers: makeHeaders({
        "webhook-id": id,
        "webhook-timestamp": ts,
        "webhook-signature": `v1,${sig}`,
      }),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an incorrect signature", () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    const result = verifyReplicateWebhook({
      rawBody: body,
      secret,
      headers: makeHeaders({
        "webhook-id": id,
        "webhook-timestamp": ts,
        "webhook-signature": "v1,not-a-real-signature",
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signature mismatch");
  });

  it("rejects when headers are missing", () => {
    const result = verifyReplicateWebhook({
      rawBody: body,
      secret,
      headers: makeHeaders({}),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing webhook headers");
  });

  it("rejects a timestamp older than the tolerance window", () => {
    const ts = (Math.floor(Date.now() / 1000) - 60 * 60).toString(); // 1h old
    const sig = sign(secret, id, ts, body);
    const result = verifyReplicateWebhook({
      rawBody: body,
      secret,
      headers: makeHeaders({
        "webhook-id": id,
        "webhook-timestamp": ts,
        "webhook-signature": `v1,${sig}`,
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("timestamp out of tolerance");
  });

  it("accepts when multiple signature versions are listed", () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    const correct = sign(secret, id, ts, body);
    const result = verifyReplicateWebhook({
      rawBody: body,
      secret,
      headers: makeHeaders({
        "webhook-id": id,
        "webhook-timestamp": ts,
        "webhook-signature": `v1,wrong-rotated v1,${correct}`,
      }),
    });
    expect(result.ok).toBe(true);
  });

  it("treats absent secret as simulated and accepts", () => {
    const result = verifyReplicateWebhook({
      rawBody: body,
      secret: null,
      headers: makeHeaders({}),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.simulated).toBe(true);
  });

  it("rejects a tampered body even with a valid header trio", () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sigForOriginal = sign(secret, id, ts, body);
    const result = verifyReplicateWebhook({
      rawBody: body + "tampered",
      secret,
      headers: makeHeaders({
        "webhook-id": id,
        "webhook-timestamp": ts,
        "webhook-signature": `v1,${sigForOriginal}`,
      }),
    });
    expect(result.ok).toBe(false);
  });
});
