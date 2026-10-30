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
