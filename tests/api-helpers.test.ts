import { describe, it, expect } from "vitest";
import { safeJson } from "../lib/api-helpers";

function makeRequest(body: string | null, contentType = "application/json"): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: body ?? undefined,
  });
}

describe("safeJson", () => {
  it("parses a valid JSON body", async () => {
    const result = await safeJson(makeRequest(JSON.stringify({ a: 1, b: "x" })));
    expect("body" in result).toBe(true);
    if ("body" in result) {
      expect(result.body).toEqual({ a: 1, b: "x" });
    }
  });

  it("returns empty object for an empty body", async () => {
    const result = await safeJson(makeRequest(null));
    expect("body" in result).toBe(true);
    if ("body" in result) {
      expect(result.body).toEqual({});
    }
  });

  it("returns a 400 NextResponse for malformed JSON", async () => {
    const result = await safeJson(makeRequest("{not json"));
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(400);
    }
  });
});
