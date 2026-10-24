import { and, eq, type SQL } from "drizzle-orm";

import { isAdmin } from "./admin";
import {
  consentRecords,
  dataLifecycleRequests,
  digitalActorAssets,
  digitalActorJobs,
  digitalActors,
  digitalActorVersions,
  familyChildren,
  familyInvitations,
  familyVoices,
  generatedClips,
  invites,
  userSavedStories,
  userStoryProgress,
  users,
  voiceJobs,
} from "./db/schema";

/**
 * Application-level authorization (Phase 4 of the local-stack migration).
 *
 * Database RLS used to enforce ownership in the database; with RLS gone,
 * every query against a user-owned table MUST carry one of these
 * predicates (or an explicit admin gate). The mapping from each removed
 * policy to the predicate that replaces it lives in
 * `db/rls-policy-map.md`:
 *
 * - "Users can read/update own data" (users)          -> selfUser
 * - family_voices owner policies                      -> voiceOwnedBy
 * - generated_clips owner policies                    -> clipOwnedBy
 * - family_invitations owner policies (user_id)       -> invitationOwnedBy
 * - family_children owner policies                    -> childOwnedBy
 * - user_saved_stories owner policies                 -> savedStoryOwnedBy
 * - user_story_progress owner policies                -> progressOwnedBy
 * - voice_jobs "read own jobs" (select only)          -> jobOwnedBy
 * - consent_records owner policies (select/insert)    -> consentOwnedBy
 * - data_lifecycle_requests owner policies            -> lifecycleOwnedBy
 * - invites owner policies (inviter_id)               -> inviteSentBy
 * - digital_actors actor_owner (all ops)              -> actorOwnedBy
 * - digital_actor_versions actor_version_owner        -> actorVersionOwnedBy
 * - digital_actor_assets actor_asset_owner            -> actorAssetOwnedBy
 * - digital_actor_jobs actor_job_owner                -> actorJobOwnedBy
 *
 * content_library has no predicate here: its policy was "any
 * authenticated user can read", so reads only require a session.
 * Tables that were only ever touched by the service role (rate_limits,
 * usage counters via RPC) stay unscoped, exactly as before.
 */

/** users: the row IS the user (`auth.uid() = id`). */
export const selfUser = (userId: string): SQL => eq(users.id, userId);

export const voiceOwnedBy = (userId: string): SQL =>
  eq(familyVoices.userId, userId);

export const clipOwnedBy = (userId: string): SQL =>
  eq(generatedClips.userId, userId);

export const invitationOwnedBy = (userId: string): SQL =>
  eq(familyInvitations.userId, userId);

export const childOwnedBy = (userId: string): SQL =>
  eq(familyChildren.userId, userId);

export const savedStoryOwnedBy = (userId: string): SQL =>
  eq(userSavedStories.userId, userId);

export const progressOwnedBy = (userId: string): SQL =>
  eq(userStoryProgress.userId, userId);

export const jobOwnedBy = (userId: string): SQL =>
  eq(voiceJobs.userId, userId);

export const consentOwnedBy = (userId: string): SQL =>
  eq(consentRecords.userId, userId);

export const lifecycleOwnedBy = (userId: string): SQL =>
  eq(dataLifecycleRequests.userId, userId);

/** invites are owned via the inviter, not a plain user_id. */
export const inviteSentBy = (userId: string): SQL =>
  eq(invites.inviterId, userId);

export const actorOwnedBy = (userId: string): SQL =>
  eq(digitalActors.userId, userId);

export const actorVersionOwnedBy = (userId: string): SQL =>
  eq(digitalActorVersions.userId, userId);

export const actorAssetOwnedBy = (userId: string): SQL =>
  eq(digitalActorAssets.userId, userId);

export const actorJobOwnedBy = (userId: string): SQL =>
  eq(digitalActorJobs.userId, userId);

/** Combine an id lookup with an ownership predicate (the common 404 pattern). */
export const byIdAndOwner = (
  idCondition: SQL,
  ownerCondition: SQL,
): SQL => and(idCondition, ownerCondition) as SQL;

/**
 * Admin gate replacing service-role usage in admin surfaces. Delegates to
 * lib/admin's isAdmin (allow-list + optional `role` column), which is how
 * admin was determined before the migration.
 */
export async function requireAdminByEmail(
  email: string | undefined | null,
): Promise<boolean> {
  return isAdmin(email);
}
