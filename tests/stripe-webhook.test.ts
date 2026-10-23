import { describe, it, expect, vi, beforeEach } from "vitest";

const constructEvent = vi.fn();
const update = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/stripe", () => ({ stripe: { webhooks: { constructEvent: (...a: unknown[]) => constructEvent(...a) } } }));
vi.mock("@/lib/monitoring", () => ({ sendOperationalAlert: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendTransactionalEmail: (...a: unknown[]) => sendEmail(...a) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (v: unknown) => ({ eq: (...a: unknown[]) => { update(v, ...a); return Promise.resolve({ error: null }); } }),
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: "u1", email: "a@b.c" } }) }) }),
    }),
  }),
}));

import { POST } from "@/app/api/stripe/webhook/route";

const req = (headers: Record<string, string> = { "stripe-signature": "sig" }) =>
  new Request("http://x/api/stripe/webhook", { method: "POST", body: "{}", headers });

describe("stripe webhook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a signature", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });

  it("rejects an invalid signature", async () => {
    constructEvent.mockImplementation(() => { throw new Error("bad sig"); });
    expect((await POST(req())).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("upgrades the plan on checkout.session.completed", async () => {
    constructEvent.mockReturnValue({ type: "checkout.session.completed", data: { object: { metadata: { supabase_user_id: "u1", plan: "family" } } } });
    expect((await POST(req())).status).toBe(200);
    expect(update).toHaveBeenCalledWith({ plan: "family" }, "id", "u1");
  });

  it("downgrades to free on customer.subscription.deleted", async () => {
    constructEvent.mockReturnValue({ type: "customer.subscription.deleted", data: { object: { customer: "cus_1" } } });
    await POST(req());
    expect(update).toHaveBeenCalledWith({ plan: "free" }, "id", "u1");
  });

  it("emails the customer on invoice.payment_failed", async () => {
    constructEvent.mockReturnValue({ type: "invoice.payment_failed", data: { object: { id: "in_1", customer: "cus_1" } } });
    await POST(req());
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "a@b.c", template: "payment-failed" }));
  });
});
