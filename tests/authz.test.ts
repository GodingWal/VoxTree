import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  selfUser,
  voiceOwnedBy,
  clipOwnedBy,
  invitationOwnedBy,
  childOwnedBy,
  savedStoryOwnedBy,
  progressOwnedBy,
  jobOwnedBy,
  consentOwnedBy,
  lifecycleOwnedBy,
  inviteSentBy,
  actorOwnedBy,
  actorVersionOwnedBy,
  actorAssetOwnedBy,
  actorJobOwnedBy,
  byIdAndOwner,
} from "@/lib/authz";
import { familyVoices } from "@/lib/db/schema";

// Phase 4 replaced database RLS with these predicates; this suite pins
// the invariant that every owner predicate binds the session user id
// against the table's owner column (per db/rls-policy-map.md).
const dialect = new PgDialect();
const UID = "user-42";

function render(sql: unknown): { text: string; params: unknown[] } {
  const q = dialect.sqlToQuery(sql as never);
  return { text: q.sql, params: q.params as unknown[] };
}

const ownerCases: Array<[string, (id: string) => unknown, string]> = [
  ["users is self (id)", selfUser, "\"users\".\"id\""],
  ["family_voices.user_id", voiceOwnedBy, "\"family_voices\".\"user_id\""],
  ["generated_clips.user_id", clipOwnedBy, "\"generated_clips\".\"user_id\""],
  ["family_invitations.user_id", invitationOwnedBy, "\"family_invitations\".\"user_id\""],
  ["family_children.user_id", childOwnedBy, "\"family_children\".\"user_id\""],
  ["user_saved_stories.user_id", savedStoryOwnedBy, "\"user_saved_stories\".\"user_id\""],
  ["user_story_progress.user_id", progressOwnedBy, "\"user_story_progress\".\"user_id\""],
  ["voice_jobs.user_id", jobOwnedBy, "\"voice_jobs\".\"user_id\""],
  ["consent_records.user_id", consentOwnedBy, "\"consent_records\".\"user_id\""],
  ["data_lifecycle_requests.user_id", lifecycleOwnedBy, "\"data_lifecycle_requests\".\"user_id\""],
  ["invites.inviter_id", inviteSentBy, "\"invites\".\"inviter_id\""],
  ["digital_actors.user_id", actorOwnedBy, "\"digital_actors\".\"user_id\""],
  // The actor child tables carry a denormalized user_id column (with a
  // composite FK to the parent actor), so their owner policies also map
  // to a direct user_id predicate.
  ["digital_actor_versions.user_id", actorVersionOwnedBy, "\"digital_actor_versions\".\"user_id\""],
  ["digital_actor_assets.user_id", actorAssetOwnedBy, "\"digital_actor_assets\".\"user_id\""],
  ["digital_actor_jobs.user_id", actorJobOwnedBy, "\"digital_actor_jobs\".\"user_id\""],
];

describe("authz owner predicates", () => {
  it.each(ownerCases)("%s binds the session user id", (_name, make, column) => {
    const { text, params } = render(make(UID));
    expect(text).toContain(column);
    expect(params).toContain(UID);
  });

  it("byIdAndOwner binds both the row id and the owner predicate", () => {
    const { text, params } = render(
      byIdAndOwner(eq(familyVoices.id, "voice-7"), voiceOwnedBy(UID)),
    );
    expect(text).toContain("\"family_voices\".\"id\"");
    expect(text).toContain("\"family_voices\".\"user_id\"");
    expect(params).toContain("voice-7");
    expect(params).toContain(UID);
  });
});
