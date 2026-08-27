import { describe, it, expect } from "vitest";
import { RateLimit } from "../lib/rate-limit";

describe("RateLimit", () => {
  it("allows requests under the limit", async () => {
    const rl = new RateLimit({ limit: 3, windowMs: 1000 });
    expect(await rl.check("ip1")).toBe(true);
    expect(await rl.check("ip1")).toBe(true);
    expect(await rl.check("ip1")).toBe(true);
  });

  it("blocks requests over the limit within the window", async () => {
    const rl = new RateLimit({ limit: 2, windowMs: 1000 });
    expect(await rl.check("ip1")).toBe(true);
    expect(await rl.check("ip1")).toBe(true);
    expect(await rl.check("ip1")).toBe(false);
  });

  it("tracks separate identities independently", async () => {
    const rl = new RateLimit({ limit: 1, windowMs: 1000 });
    expect(await rl.check("ip1")).toBe(true);
    expect(await rl.check("ip1")).toBe(false);
    expect(await rl.check("ip2")).toBe(true);
  });

  it("resets after the window expires", async () => {
    const rl = new RateLimit({ limit: 1, windowMs: 10 });
    expect(await rl.check("ip1")).toBe(true);
    expect(await rl.check("ip1")).toBe(false);
    await new Promise(r => setTimeout(r, 20));
    expect(await rl.check("ip1")).toBe(true);
  });
});
