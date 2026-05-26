import { describe, it, expect } from "vitest";
import { RateLimit } from "../lib/rate-limit";

describe("RateLimit", () => {
  it("allows requests under the limit", () => {
    const rl = new RateLimit({ limit: 3, windowMs: 1000 });
    expect(rl.check("ip1")).toBe(true);
    expect(rl.check("ip1")).toBe(true);
    expect(rl.check("ip1")).toBe(true);
  });

  it("blocks requests over the limit within the window", () => {
    const rl = new RateLimit({ limit: 2, windowMs: 1000 });
    expect(rl.check("ip1")).toBe(true);
    expect(rl.check("ip1")).toBe(true);
    expect(rl.check("ip1")).toBe(false);
  });

  it("tracks separate identities independently", () => {
    const rl = new RateLimit({ limit: 1, windowMs: 1000 });
    expect(rl.check("ip1")).toBe(true);
    expect(rl.check("ip1")).toBe(false);
    expect(rl.check("ip2")).toBe(true);
  });

  it("resets after the window expires", async () => {
    const rl = new RateLimit({ limit: 1, windowMs: 10 });
    expect(rl.check("ip1")).toBe(true);
    expect(rl.check("ip1")).toBe(false);
    await new Promise(r => setTimeout(r, 20));
    expect(rl.check("ip1")).toBe(true);
  });
});
