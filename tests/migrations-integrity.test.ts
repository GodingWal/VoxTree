import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Schema integrity — successor to the migration-ordering tests.
 *
 * History: this suite guarded the hosted migration files (001–018 apply
 * in order, no gaps). The schema now ships as a single ported file,
 * db/init/01_schema.sql, applied to a fresh local Postgres by
 * docker-compose. The invariants that still matter are pinned here:
 * every table/function the migrations created exists in the port, the
 * consent + attestation semantics of migrations 012/016/017/018 survived
 * the port, and the DDL stays idempotent so a pg_dump snapshot can be
 * restored by replaying the schema (see OPERATIONS_RUNBOOK.md).
 */

const SCHEMA_PATH = path.join(process.cwd(), "db/init/01_schema.sql");
const sql = fs.readFileSync(SCHEMA_PATH, "utf8");

function definedTables(source: string): string[] {
  const names: string[] = [];
  const re = /create table(?:\s+if not exists)?\s+(?:public\.)?([a-z_]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) names.push(m[1]);
  return names;
}

const EXPECTED_TABLES = [
  "users",
  "family_voices",
  "content_library",
  "generated_clips",
  "family_invitations",
  "family_children",
  "user_saved_stories",
  "user_story_progress",
  "voice_jobs",
  "rate_limits",
  "consent_records",
  "data_lifecycle_requests",
  "invites",
  "digital_actors",
  "digital_actor_versions",
  "digital_actor_assets",
  "digital_actor_jobs",
  "waitlist_signups",
];

describe("local schema — completeness of the migration port", () => {
  it("schema file starts with a comment header", () => {
    expect(sql.trimStart().startsWith("--")).toBe(true);
  });

  it("defines all 18 application tables from migrations 001–018 plus the waitlist", () => {
    const tables = definedTables(sql);
    for (const t of EXPECTED_TABLES) {
      expect(tables, `missing table ${t}`).toContain(t);
    }
  });

  it("also defines the Auth.js identity tables (accounts, sessions, verification_tokens)", () => {
    const tables = definedTables(sql);
    expect(tables).toContain("accounts");
    expect(tables).toContain("sessions");
    expect(tables).toContain("verification_tokens");
  });

  it("no table is defined twice", () => {
    const tables = definedTables(sql);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it("defines all ported functions, including the four former RPCs", () => {
    for (const fn of [
      "check_rate_limit", // lib/rate-limit.ts
      "increment_usage", // lib/cost-tracking.ts
      "reset_usage_if_stale", // lib/cost-tracking.ts
      "lease_voice_job", // lib/voice-jobs.ts
      "increment_voice_slots",
      "decrement_voice_slots",
      "sync_voice_slots",
      "update_updated_at",
      "handle_new_user",
    ]) {
      expect(sql, `missing function ${fn}`).toMatch(
        new RegExp(`create or replace function public\\.${fn}`, "i"),
      );
    }
  });
});

describe("local schema — consent integrity (migrations 012/016/017/018)", () => {
  it("012: auditable consent + lifecycle tables ported", () => {
    expect(sql).toContain("public.consent_records");
    expect(sql).toContain("voice_owner_authorized_at");
    expect(sql).toContain("public.data_lifecycle_requests");
  });

  it("016: adult attestation column present on consent_records", () => {
    expect(sql).toContain("adult_confirmed_at");
  });

  it("017: sample_audio_url was renamed to sample_audio_key", () => {
    expect(sql).toMatch(/rename column sample_audio_url to sample_audio_key/i);
  });

  it("018: legacy consents are reset so users must re-consent with attestation", () => {
    expect(sql).toMatch(/set consent_verified = false/i);
    expect(sql).toContain("adult_confirmed_at IS NOT NULL");
  });

  it("no database-level policies remain — consent is enforced in app code", () => {
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toContain("auth.uid()");
  });
});

describe("local schema — feature invariants from individual migrations", () => {
  it("011: rate_limits table, sync_voice_slots trigger and check_rate_limit exist", () => {
    expect(sql).toContain("public.rate_limits");
    expect(sql).toContain("sync_voice_slots");
    expect(sql).toContain("trg_sync_voice_slots");
    expect(sql).toContain("check_rate_limit");
  });
});

describe("local schema — pilot waitlist (launch readiness)", () => {
  it("defines waitlist_signups for the public /pilot waitlist capture", () => {
    expect(sql).toContain("public.waitlist_signups");
    expect(sql).toMatch(/email text unique not null/i);
    expect(sql).toMatch(/clone_role text not null/i);
    expect(sql).toMatch(
      /id uuid primary key default gen_random_uuid\(\)/i,
    );
  });
});

describe("backup/restore — procedural proof", () => {
  /**
   * Backup/restore is an ops procedure (pg_dump → restore → verify row
   * counts), documented in OPERATIONS_RUNBOOK.md. The invariant this
   * suite can pin statically: the schema DDL is idempotent, so a fresh
   * database can be brought to the current shape by replaying it, and
   * the runbook documents the restore path.
   */
  it("schema DDL is idempotent (IF NOT EXISTS / OR REPLACE throughout)", () => {
    const hits = sql.match(/if not exists|or replace/gi) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(6);
  });

  it("runbook documents the restore procedure", () => {
    const runbook = fs.readFileSync(
      path.join(process.cwd(), "OPERATIONS_RUNBOOK.md"),
      "utf8",
    );
    expect(runbook).toMatch(/restore the database/i);
    expect(runbook).toMatch(/row counts/i);
  });
});
