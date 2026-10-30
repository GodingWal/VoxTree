import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Item 1: inviteFamilyMember used to fake success on a DB insert
// failure when simulation mode was on ("Invitation simulated
// successfully! ... apply the database migrations"). That copy/behavior
// is gone: an insert failure is an honest error in every mode, and a
// successful insert is the only success path.

const state = vi.hoisted(() => ({
  plan: "premium" as string,
  insertError: null as unknown,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUserId: async () => "user-a",
}));

vi.mock("@/lib/db", async () => {
  const { getTableName } = await import("drizzle-orm");
  const chain = (rows: unknown[]) => {
    const c: Record<string, unknown> = {};
    for (const m of ["where", "limit", "orderBy"]) c[m] = () => c;
    c.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
      Promise.resolve(rows).then(res, rej);
    return c;
  };
  return {
    db: {
      select: () => ({
        from: (table: unknown) =>
          chain(
            getTableName(table as never) === "users"
              ? [{ plan: state.plan }]
              : []
          ),
      }),
      insert: () => ({
        values: async () => {
          if (state.insertError) throw state.insertError;
          return [];
        },
      }),
    },
  };
});

import { inviteFamilyMember } from "@/app/dashboard/family/actions";

function form(email: string) {
  const fd = new FormData();
  fd.set("email", email);
  return fd;
}

beforeEach(() => {
  state.plan = "premium";
  state.insertError = null;
});

afterEach(() => {
  delete process.env.SIMULATION_MODE;
});

describe("inviteFamilyMember", () => {
  it("returns success with the email when the insert succeeds", async () => {
    const res = await inviteFamilyMember(form("grandma@family.com"));
    expect(res).toEqual({ success: true, email: "grandma@family.com" });
  });

  it("returns an honest error when the insert fails", async () => {
    state.insertError = new Error("relation \"family_invitations\" does not exist");
    const res = await inviteFamilyMember(form("grandma@family.com"));
    expect(res).toEqual({
      success: false,
      error: "Invitation could not be saved.",
    });
  });

  it("still returns an honest error on insert failure even in simulation mode (no fake simulated success)", async () => {
    process.env.SIMULATION_MODE = "true";
    state.insertError = new Error("db down");
    const res = await inviteFamilyMember(form("grandma@family.com"));
    expect(res.success).toBe(false);
    expect(res).not.toHaveProperty("simulated");
    expect(JSON.stringify(res)).not.toMatch(/simulat/i);
  });
});
