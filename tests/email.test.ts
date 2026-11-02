import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { sendEmail, waitlistConfirmationEmail } from "@/lib/email";

/**
 * lib/email.ts sendEmail: provider-pluggable direct email.
 * - No RESEND_API_KEY => logged no-op, { sent: false }, no fetch.
 * - With a key => POST to Resend's HTTPS API with the EMAIL_FROM
 *   sender (or the built-in placeholder default).
 * - Provider/network failure => { sent: false }, never throws, so
 *   request paths can fire-and-forget it.
 */

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sendEmail", () => {
  it("is a no-op when RESEND_API_KEY is not set — no fetch, no throw", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    // stubEnv with "" leaves the var present-but-empty; sendEmail
    // treats empty as unset. Delete to cover the truly-unset path too.
    delete process.env.RESEND_API_KEY;
    const result = await sendEmail({ to: "ada@example.com", subject: "Hi", text: "Body" });
    expect(result).toEqual({ sent: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends through the Resend API with EMAIL_FROM when a key is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "VoxTree <hello@vox-tree.com>");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "resend-id-1" }),
    });
    const result = await sendEmail({ to: "ada@example.com", subject: "Welcome", text: "Body" });
    expect(result).toEqual({ sent: true, id: "resend-id-1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    expect(JSON.parse(init.body)).toEqual({
      from: "VoxTree <hello@vox-tree.com>",
      to: ["ada@example.com"],
      subject: "Welcome",
      text: "Body",
    });
  });

  it("returns provider_error (does not throw) when Resend rejects", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    fetchMock.mockResolvedValue({ ok: false, status: 422, json: async () => ({}) });
    const result = await sendEmail({ to: "ada@example.com", subject: "Hi", text: "Body" });
    expect(result).toEqual({ sent: false, reason: "provider_error" });
  });

  it("returns provider_error (does not throw) when the network fails", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    fetchMock.mockRejectedValue(new Error("connection reset"));
    const result = await sendEmail({ to: "ada@example.com", subject: "Hi", text: "Body" });
    expect(result).toEqual({ sent: false, reason: "provider_error" });
  });
});

describe("waitlistConfirmationEmail (marketing kit Email 1)", () => {
  const { subject, text } = waitlistConfirmationEmail("Ada Grandma");

  it("greets by first name and keeps the kit subject", () => {
    expect(subject).toContain("You're on the VoxTree list");
    expect(text).toContain("Hi Ada,");
  });

  it("keeps the honesty framing: not launched, pilot, nothing charged yet", () => {
    expect(text).toContain("VoxTree isn't launched yet");
    expect(text).toContain("pilot");
    expect(text).toContain("before anything is charged");
  });

  it("states the decided pilot price, not the kit's superseded $99/year", () => {
    expect(text).toContain("$29.99/month");
    expect(text).not.toContain("$99");
  });

  it("keeps the founding rule: adults consent for themselves, children never cloned", () => {
    expect(text).toContain("adults who consent for themselves");
    expect(text).toContain("Children are never cloned");
  });
});
