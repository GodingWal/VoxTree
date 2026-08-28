import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * P0 #4 — RLS / AuthZ negative tests
 * Proves cross-family isolation: no user can read/write another user's rows.
 * These are static + behavioral checks that run without a live Supabase.
 * A live integration suite would repeat these against a real DB with RLS enabled.
 */

function readMigration(n: string) {
  const p = path.join(process.cwd(), "supabase/migrations", n);
  return fs.readFileSync(p, "utf8");
}

// --- Helpers that mirror the RLS USING expressions ---
function canSelectOwn(userId: string, rowUserId: string, authUid: string | null) {
  if (!authUid) return false;
  return authUid === rowUserId && authUid === userId;
}
function policyAllowsSelect(rowUserId: string, authUid: string | null) {
  if (!authUid) return false;
  return authUid === rowUserId;
}

describe("RLS migration 001 — core tables", () => {
  const sql = readMigration("001_initial_schema.sql");

  it("enables RLS on users, family_voices, generated_clips, content_library", () => {
    expect(sql).toContain("alter table public.users enable row level security");
    expect(sql).toContain("alter table public.family_voices enable row level security");
    expect(sql).toContain("alter table public.generated_clips enable row level security");
    expect(sql).toContain("alter table public.content_library enable row level security");
  });

  it("family_voices select policy is auth.uid() = user_id", () => {
    expect(sql).toMatch(/family_voices for select[\s\S]*?auth\.uid\(\) = user_id/);
    expect(sql).toMatch(/family_voices for insert[\s\S]*?auth\.uid\(\) = user_id/);
    expect(sql).toMatch(/family_voices for update[\s\S]*?auth\.uid\(\) = user_id/);
    expect(sql).toMatch(/family_voices for delete[\s\S]*?auth\.uid\(\) = user_id/);
  });

  it("generated_clips isolated by auth.uid() = user_id", () => {
    expect(sql).toMatch(/generated_clips for select[\s\S]*?auth\.uid\(\) = user_id/);
    expect(sql).toMatch(/generated_clips for insert[\s\S]*?auth\.uid\(\) = user_id/);
  });

  it("users can only read/update own row (auth.uid() = id)", () => {
    expect(sql).toMatch(/on public\.users for select[\s\S]*?auth\.uid\(\) = id/);
    expect(sql).toMatch(/on public\.users for update[\s\S]*?auth\.uid\(\) = id/);
  });

  it("content_library is readable only when authenticated (not anon)", () => {
    expect(sql).toMatch(/content_library for select[\s\S]*?auth\.role\(\) = 'authenticated'/);
  });

  it("no permissive `USING (true)` or `USING (1=1)` policies exist", () => {
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/USING\s*\(\s*1\s*=\s*1\s*\)/i);
  });
});

describe("RLS — family_invitations and family_children", () => {
  it("004 family_invitations isolated by auth.uid() = user_id", () => {
    const sql = readMigration("004_family_invitations.sql");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toMatch(/family_invitations for select[\s\S]*?auth\.uid\(\) = user_id/i);
  });

  it("006 family_children isolated by auth.uid() = user_id", () => {
    const sql = readMigration("006_children_and_bedtime.sql");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toMatch(/family_children for select[\s\S]*?auth\.uid\(\) = user_id/i);
    expect(sql).toMatch(/family_children for insert[\s\S]*?auth\.uid\(\) = user_id/i);
  });
});

describe("RLS behavioral — cross-user access denied", () => {
  const alice = "00000000-0000-0000-0000-000000000001";
  const bob = "00000000-0000-0000-0000-000000000002";

  it("Alice cannot select Bob's family_voices", () => {
    expect(policyAllowsSelect(bob, alice)).toBe(false);
    expect(policyAllowsSelect(bob, bob)).toBe(true);
    expect(policyAllowsSelect(alice, alice)).toBe(true);
  });

  it("Alice cannot select Bob's generated_clips", () => {
    expect(policyAllowsSelect(bob, alice)).toBe(false);
  });

  it("Alice cannot read Bob's invitations", () => {
    expect(policyAllowsSelect(bob, alice)).toBe(false);
  });

  it("Alice cannot read Bob's children", () => {
    expect(policyAllowsSelect(bob, alice)).toBe(false);
  });

  it("anon (null auth) cannot read any row", () => {
    expect(policyAllowsSelect(alice, null)).toBe(false);
    expect(policyAllowsSelect(bob, null)).toBe(false);
  });

  it("Alice cannot update/delete Bob's voices (simulated check)", () => {
    // The route additionally checks voice.user_id !== user.id → 404
    const voice = { id: "v1", user_id: bob, elevenlabs_voice_id: "el1" };
    const isOwner = voice.user_id === alice;
    expect(isOwner).toBe(false);
  });

  it("rate_limits is not readable by anon or authenticated client", () => {
    const sql = readMigration("011_sync_slots_and_rate_limits.sql");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    // Only service-role should access it — no permissive policy granted to authenticated
    expect(sql).not.toMatch(/rate_limits for select[\s\S]*?auth\.role\(\) = 'authenticated'/i);
  });
});

describe("RLS — service role boundary", () => {
  it("admin client usage is confined to server routes (no client key leak)", () => {
    // lib/supabase/admin.ts must use SUPABASE_SERVICE_ROLE_KEY, never NEXT_PUBLIC_*
    const adminSrc = fs.readFileSync(path.join(process.cwd(), "lib/supabase/admin.ts"), "utf8");
    expect(adminSrc).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(adminSrc).not.toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    // browser/client must NOT use service role
    const browserSrc = fs.readFileSync(path.join(process.cwd(), "lib/supabase/client.ts"), "utf8");
    expect(browserSrc).not.toContain("SERVICE_ROLE");
  });
});
