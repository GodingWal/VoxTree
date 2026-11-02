import { describe, it, expect, vi, beforeEach } from "vitest";

const insertValues = vi.fn();

// The route writes through Drizzle (lib/db). The mock captures the
// values passed to insert(waitlistSignups).values(...) so tests can
// assert normalization (trimmed name, lowercased email, role mapped
// to clone_role) without a database.
vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: (...a: unknown[]) => insertValues(...a),
    }),
  },
}));

const sendEmailMock = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (...a: unknown[]) => sendEmailMock(...a),
  waitlistConfirmationEmail: (name: string) => ({
    subject: "You're on the VoxTree list",
    text: `Hi ${name}, welcome`,
  }),
}));

import { POST } from "@/app/api/waitlist/route";

const req = (body: unknown) =>
  new Request("http://x/api/waitlist", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("waitlist route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertValues.mockResolvedValue([]);
    sendEmailMock.mockResolvedValue({ sent: true, id: "email-1" });
  });

  it("accepts a valid signup and stores a normalized row", async () => {
    const res = await POST(
      req({ name: "  Ada Grandma  ", email: "ADA@Example.COM", role: "grandparent" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insertValues).toHaveBeenCalledWith({
      name: "Ada Grandma",
      email: "ada@example.com",
      cloneRole: "grandparent",
    });
  });

  it("sends the confirmation email to the normalized address on a new signup", async () => {
    const res = await POST(
      req({ name: "Ada Grandma", email: "ADA@Example.COM", role: "grandparent" }),
    );
    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith({
      to: "ada@example.com",
      subject: "You're on the VoxTree list",
      text: "Hi Ada Grandma, welcome",
    });
  });

  it("does not send the confirmation email on a duplicate signup", async () => {
    insertValues.mockRejectedValueOnce(
      Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" }),
    );
    const res = await POST(
      req({ name: "Ada Grandma", email: "ada@example.com", role: "parent" }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("signup still succeeds when the confirmation email fails", async () => {
    sendEmailMock.mockRejectedValue(new Error("resend is down"));
    const res = await POST(
      req({ name: "Ada Grandma", email: "ada@example.com", role: "grandparent" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    // Let the fire-and-forget rejection land in the route's catch
    // handler before the test ends.
    await new Promise((r) => setTimeout(r, 0));
  });

  it("returns a friendly duplicate response on a unique violation (23505)", async () => {
    insertValues.mockRejectedValueOnce(
      Object.assign(
        new Error("duplicate key value violates unique constraint"),
        { code: "23505" },
      ),
    );
    const res = await POST(
      req({ name: "Ada Grandma", email: "ada@example.com", role: "parent" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.duplicate).toBe(true);
    expect(body.message).toMatch(/already on the list/i);
  });

  it("rejects an invalid email with 400 and does not insert", async () => {
    const res = await POST(
      req({ name: "Ada Grandma", email: "not-an-email", role: "grandparent" }),
    );
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("rejects an invalid role with 400 and does not insert", async () => {
    const res = await POST(
      req({ name: "Ada Grandma", email: "ada@example.com", role: "child" }),
    );
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("rejects a missing or over-long name with 400", async () => {
    expect(
      (await POST(req({ name: "   ", email: "ada@example.com", role: "other" }))).status,
    ).toBe(400);
    expect(
      (
        await POST(
          req({ name: "a".repeat(121), email: "ada@example.com", role: "other" }),
        )
      ).status,
    ).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });
});
