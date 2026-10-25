/**
 * Drizzle schema for VoxTree's local Postgres database.
 *
 * Source of truth: `db/init/01_schema.sql` — the port of the former hosted
 * migrations 001–018 created in Phase 1 of the local-stack migration
 * (see `db/rls-policy-map.md` for the RLS policies that become
 * app-level checks in Phase 4). Column names and types mirror the
 * SQL file exactly, with all ALTERs folded into the final state:
 *
 * - `users.plan` uses the 002 check ('free' | 'family' | 'premium')
 * - `family_voices.sample_audio_key` is the 017 rename of
 *   `sample_audio_url`
 * - `generated_clips.content_id` is nullable (009 dropped NOT NULL)
 * - Provider-neutral names from Phase 1 (`provider_voice_id`,
 *   `tts_chars_used`)
 *
 * Phase 3 (auth swap) additions, mirrored at the end of 01_schema.sql:
 * - `users` gains `email` (unique), `email_verified`, `image`, and
 *   `password_hash` (NULL for OAuth-only accounts).
 * - Auth.js tables: `accounts`, `sessions`, `verification_tokens`
 *   (the last also stores password-reset tokens — see
 *   lib/auth/password-reset.ts). Sessions are JWT-based; the sessions
 *   table is kept for adapter completeness.
 *
 * Notes:
 * - `updated_at` columns are maintained by the `update_updated_at()`
 *   DB trigger in the SQL schema, so no app-level on-update is set.
 * - `digital_actor_versions` has a single-column FK to
 *   `digital_actors(id)` in SQL in addition to the composite
 *   (actor_id, user_id) FK; only the composite FK is expressed here —
 *   it enforces the same parent row.
 */
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ============================================================
// 001–018 core tables
// ============================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    plan: text("plan").notNull().default("free"),
    voiceSlotsUsed: integer("voice_slots_used").notNull().default(0),
    clipsUsedThisMonth: integer("clips_used_this_month").notNull().default(0),
    clipsResetAt: timestamp("clips_reset_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    stripeCustomerId: text("stripe_customer_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // 002
    videosUsed: integer("videos_used").notNull().default(0),
    storiesUsed: integer("stories_used").notNull().default(0),
    // 005
    avatarUrl: text("avatar_url"),
    // 006
    bedtimeTime: text("bedtime_time").notNull().default("21:00"),
    bedtimeAutodim: boolean("bedtime_autodim").notNull().default(true),
    defaultBackgroundAudio: text("default_background_audio")
      .notNull()
      .default("soft_rain"),
    consentVerified: boolean("consent_verified").notNull().default(false),
    // 010
    ttsCharsUsed: integer("tts_chars_used").notNull().default(0),
    replicateTrainingsUsed: integer("replicate_trainings_used")
      .notNull()
      .default(0),
    replicateInferencesUsed: integer("replicate_inferences_used")
      .notNull()
      .default(0),
    usageResetAt: timestamp("usage_reset_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // 012
    consentVerifiedAt: timestamp("consent_verified_at", {
      withTimezone: true,
    }),
    consentNoticeVersion: text("consent_notice_version"),
    // Phase 3 — Auth.js identity columns (see 01_schema.sql tail)
    email: text("email").unique(),
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    image: text("image"),
    passwordHash: text("password_hash"),
  },
  (table) => [
    check("users_plan_check", sql`"plan" in ('free', 'family', 'premium')`),
    index("users_email_idx").on(table.email),
  ],
);

// ============================================================
// Phase 3 — Auth.js (NextAuth v5) Drizzle-adapter tables
// Column/property names follow the @auth/drizzle-adapter contract.
// ============================================================

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    // Integer (not bigint): the @auth/drizzle-adapter contract requires
    // a PgInteger column here; the value is epoch seconds.
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
  ],
);

export const familyVoices = pgTable(
  "family_voices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    providerVoiceId: text("provider_voice_id"),
    // 017: renamed from sample_audio_url
    sampleAudioKey: text("sample_audio_key"),
    status: text("status").notNull().default("processing"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // 003
    rvcModelId: text("rvc_model_id"),
    rvcTrainingStatus: text("rvc_training_status"),
    // 005
    avatarUrl: text("avatar_url"),
    idleVideoUrl: text("idle_video_url"),
    talkingVideoUrl: text("talking_video_url"),
    // 008
    loraTrainingId: text("lora_training_id"),
    loraDestination: text("lora_destination"),
    loraVersion: text("lora_version"),
    loraWeightsUrl: text("lora_weights_url"),
    loraTriggerWord: text("lora_trigger_word"),
    loraStatus: text("lora_status"),
    characterReferenceImages: jsonb("character_reference_images")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),
    // 010
    sampleSha256: text("sample_sha256"),
    sampleDurationSeconds: numeric("sample_duration_seconds"),
    sampleBytes: bigint("sample_bytes", { mode: "number" }),
    // 012
    voiceOwnerName: text("voice_owner_name"),
    voiceOwnerRelationship: text("voice_owner_relationship"),
    voiceOwnerAuthorizedAt: timestamp("voice_owner_authorized_at", {
      withTimezone: true,
    }),
    authorizationNoticeVersion: text("authorization_notice_version"),
  },
  (table) => [
    index("idx_family_voices_user_id").on(table.userId),
    index("family_voices_lora_training_id_idx")
      .on(table.loraTrainingId)
      .where(sql`"lora_training_id" is not null`),
    index("idx_family_voices_sample_sha256")
      .on(table.sampleSha256)
      .where(sql`"sample_sha256" is not null`),
    check(
      "family_voices_status_check",
      sql`"status" in ('processing', 'ready', 'failed')`,
    ),
  ],
);

export const contentLibrary = pgTable(
  "content_library",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    series: text("series"),
    episodeNumber: integer("episode_number"),
    originalVideoUrl: text("original_video_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    durationSeconds: integer("duration_seconds"),
    ageRange: text("age_range"),
    tags: text("tags")
      .array()
      .default(sql`'{}'`),
    isPremium: boolean("is_premium").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // 002
    contentType: text("content_type").notNull().default("video"),
    // 003
    contentMode: text("content_mode").notNull().default("tts"),
    textScript: text("text_script"),
    isolatedVocalsUrl: text("isolated_vocals_url"),
    instrumentalUrl: text("instrumental_url"),
    // 007
    synopsis: text("synopsis"),
  },
  (table) => [
    index("idx_content_library_series").on(table.series),
    index("idx_content_library_premium").on(table.isPremium),
    check(
      "content_library_content_type_check",
      sql`"content_type" in ('video', 'story')`,
    ),
    check("content_mode_check", sql`"content_mode" in ('tts', 'v2v')`),
  ],
);

export const generatedClips = pgTable(
  "generated_clips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 009: NOT NULL dropped — talking-head clips have no library item
    contentId: uuid("content_id").references(() => contentLibrary.id, {
      onDelete: "cascade",
    }),
    voiceId: uuid("voice_id")
      .notNull()
      .references(() => familyVoices.id, { onDelete: "cascade" }),
    outputAudioUrl: text("output_audio_url"),
    outputVideoUrl: text("output_video_url"),
    status: text("status").notNull().default("queued"),
    cached: boolean("cached").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // 009
    hedraGenerationId: text("hedra_generation_id"),
    talkingVideoUrl: text("talking_video_url"),
  },
  (table) => [
    index("idx_generated_clips_user_id").on(table.userId),
    index("idx_generated_clips_cache_lookup").on(
      table.contentId,
      table.voiceId,
      table.status,
    ),
    index("generated_clips_hedra_generation_id_idx")
      .on(table.hedraGenerationId)
      .where(sql`"hedra_generation_id" is not null`),
    check(
      "generated_clips_status_check",
      sql`"status" in ('queued', 'processing', 'ready', 'failed')`,
    ),
  ],
);

// 004
export const familyInvitations = pgTable(
  "family_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [
    check(
      "family_invitations_status_check",
      sql`"status" in ('pending', 'accepted')`,
    ),
  ],
);

// 006
export const familyChildren = pgTable("family_children", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// 007
export const userSavedStories = pgTable(
  "user_saved_stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentId: uuid("content_id")
      .notNull()
      .references(() => contentLibrary.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_user_saved_stories_user").on(table.userId),
    index("idx_user_saved_stories_content").on(table.contentId),
    unique("user_saved_stories_user_id_content_id_key").on(
      table.userId,
      table.contentId,
    ),
  ],
);

// 007
export const userStoryProgress = pgTable(
  "user_story_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentId: uuid("content_id")
      .notNull()
      .references(() => contentLibrary.id, { onDelete: "cascade" }),
    progressSeconds: integer("progress_seconds").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_user_story_progress_user").on(table.userId),
    unique("user_story_progress_user_id_content_id_key").on(
      table.userId,
      table.contentId,
    ),
  ],
);

// 010
export const voiceJobs = pgTable(
  "voice_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    workerId: text("worker_id"),
    result: jsonb("result").$type<Record<string, unknown>>(),
    idempotencyKey: text("idempotency_key").unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_voice_jobs_status_locked")
      .on(table.status, table.lockedUntil)
      .where(sql`"status" in ('queued', 'running')`),
    index("idx_voice_jobs_user").on(table.userId),
    check(
      "voice_jobs_type_check",
      sql`"type" in ('voice_clone', 'singing_train', 'clip_generate', 'talking_video', 'lora_train')`,
    ),
    check(
      "voice_jobs_status_check",
      sql`"status" in ('queued', 'running', 'succeeded', 'failed', 'cancelled')`,
    ),
  ],
);

// 011
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

// 012 (+013 video proof, +016 adult attestation)
export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    noticeVersion: text("notice_version").notNull(),
    parentName: text("parent_name").notNull(),
    parentRelationship: text("parent_relationship").notNull(),
    signatureSha256: text("signature_sha256").notNull(),
    voiceOwnerAuthorizationConfirmed: boolean(
      "voice_owner_authorization_confirmed",
    )
      .notNull()
      .default(false),
    ipSha256: text("ip_sha256"),
    userAgent: text("user_agent"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    // 013
    videoGcsKey: text("video_gcs_key"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    // 016
    adultConfirmedAt: timestamp("adult_confirmed_at", { withTimezone: true }),
  },
  (table) => [
    index("consent_records_user_id_idx").on(table.userId, table.acceptedAt),
    index("consent_records_video_gcs_key_idx")
      .on(table.videoGcsKey)
      .where(sql`"video_gcs_key" is not null`),
  ],
);

// 012
export const dataLifecycleRequests = pgTable(
  "data_lifecycle_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestType: text("request_type").notNull(),
    status: text("status").notNull().default("requested"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
  },
  () => [
    check(
      "data_lifecycle_requests_request_type_check",
      sql`"request_type" in ('export', 'delete', 'revoke_consent')`,
    ),
    check(
      "data_lifecycle_requests_status_check",
      sql`"status" in ('requested', 'processing', 'completed', 'failed')`,
    ),
  ],
);

// 014
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeEmail: text("invitee_email"),
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("pending"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '14 days'`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_invites_inviter_created").on(table.inviterId, table.createdAt),
    check(
      "invites_status_check",
      sql`"status" in ('pending', 'accepted', 'expired', 'revoked')`,
    ),
  ],
);

// ============================================================
// 015 digital actors (versioned identities)
// ============================================================

export const digitalActors = pgTable(
  "digital_actors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("capture_required"),
    identity: jsonb("identity").$type<Record<string, unknown>>().notNull(),
    consent: jsonb("consent").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("digital_actors_id_user_id_key").on(table.id, table.userId),
    check("digital_actors_version_check", sql`"version" > 0`),
    check(
      "digital_actors_status_check",
      sql`"status" in ('capture_required', 'processing', 'ready', 'failed')`,
    ),
  ],
);

export const digitalActorVersions = pgTable(
  "digital_actor_versions",
  {
    actorId: uuid("actor_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    identity: jsonb("identity").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.actorId, table.version] }),
    foreignKey({
      columns: [table.actorId, table.userId],
      foreignColumns: [digitalActors.id, digitalActors.userId],
      name: "digital_actor_versions_actor_id_user_id_fkey",
    }).onDelete("cascade"),
    check("digital_actor_versions_version_check", sql`"version" > 0`),
  ],
);

export const digitalActorAssets = pgTable(
  "digital_actor_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").notNull(),
    userId: uuid("user_id").notNull(),
    actorVersion: integer("actor_version").notNull(),
    kind: text("kind").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    contentType: text("content_type").notNull(),
    bytes: bigint("bytes", { mode: "number" }).notNull(),
    modelId: text("model_id"),
    modelVersion: text("model_version"),
    dependencies: uuid("dependencies")
      .array()
      .notNull()
      .default(sql`'{}'`),
  },
  (table) => [
    foreignKey({
      columns: [table.actorId, table.userId],
      foreignColumns: [digitalActors.id, digitalActors.userId],
      name: "digital_actor_assets_actor_id_user_id_fkey",
    }).onDelete("cascade"),
    check("digital_actor_assets_actor_version_check", sql`"actor_version" > 0`),
    check(
      "digital_actor_assets_kind_check",
      sql`"kind" in ('face', 'body', 'voice', 'hair', 'skin', 'realistic', 'stylized', 'preview', 'production')`,
    ),
    check("digital_actor_assets_bytes_check", sql`"bytes" > 0`),
  ],
);

export const digitalActorJobs = pgTable(
  "digital_actor_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").notNull(),
    userId: uuid("user_id").notNull(),
    actorVersion: integer("actor_version").notNull(),
    stage: text("stage").notNull(),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    leaseToken: uuid("lease_token"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("digital_actor_jobs_pending").on(table.status, table.createdAt),
    unique("digital_actor_jobs_actor_id_actor_version_stage_key").on(
      table.actorId,
      table.actorVersion,
      table.stage,
    ),
    foreignKey({
      columns: [table.actorId, table.userId],
      foreignColumns: [digitalActors.id, digitalActors.userId],
      name: "digital_actor_jobs_actor_id_user_id_fkey",
    }).onDelete("cascade"),
    check("digital_actor_jobs_actor_version_check", sql`"actor_version" > 0`),
    check(
      "digital_actor_jobs_stage_check",
      sql`"stage" in ('CAPTURE_PROCESS', 'FACE_RECONSTRUCT', 'BODY_RECONSTRUCT', 'AVATAR_BUILD', 'AVATAR_STYLIZE', 'PREVIEW_GENERATE', 'RENDER_PACKAGE_GENERATE')`,
    ),
    check(
      "digital_actor_jobs_status_check",
      sql`"status" in ('queued', 'running', 'completed', 'failed', 'retrying')`,
    ),
  ],
);

// ============================================================
// Relations (query-builder convenience only; FKs above are the
// actual constraints)
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  familyVoices: many(familyVoices),
  generatedClips: many(generatedClips),
  familyInvitations: many(familyInvitations),
  familyChildren: many(familyChildren),
  savedStories: many(userSavedStories),
  storyProgress: many(userStoryProgress),
  voiceJobs: many(voiceJobs),
  consentRecords: many(consentRecords),
  dataLifecycleRequests: many(dataLifecycleRequests),
  invites: many(invites, { relationName: "inviter" }),
  digitalActors: many(digitalActors),
  digitalActorVersions: many(digitalActorVersions),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const familyVoicesRelations = relations(familyVoices, ({ one, many }) => ({
  user: one(users, {
    fields: [familyVoices.userId],
    references: [users.id],
  }),
  generatedClips: many(generatedClips),
}));

export const contentLibraryRelations = relations(contentLibrary, ({ many }) => ({
  generatedClips: many(generatedClips),
  savedStories: many(userSavedStories),
  storyProgress: many(userStoryProgress),
}));

export const generatedClipsRelations = relations(generatedClips, ({ one }) => ({
  user: one(users, {
    fields: [generatedClips.userId],
    references: [users.id],
  }),
  content: one(contentLibrary, {
    fields: [generatedClips.contentId],
    references: [contentLibrary.id],
  }),
  voice: one(familyVoices, {
    fields: [generatedClips.voiceId],
    references: [familyVoices.id],
  }),
}));

export const familyInvitationsRelations = relations(
  familyInvitations,
  ({ one }) => ({
    user: one(users, {
      fields: [familyInvitations.userId],
      references: [users.id],
    }),
  }),
);

export const familyChildrenRelations = relations(familyChildren, ({ one }) => ({
  user: one(users, {
    fields: [familyChildren.userId],
    references: [users.id],
  }),
}));

export const userSavedStoriesRelations = relations(
  userSavedStories,
  ({ one }) => ({
    user: one(users, {
      fields: [userSavedStories.userId],
      references: [users.id],
    }),
    content: one(contentLibrary, {
      fields: [userSavedStories.contentId],
      references: [contentLibrary.id],
    }),
  }),
);

export const userStoryProgressRelations = relations(
  userStoryProgress,
  ({ one }) => ({
    user: one(users, {
      fields: [userStoryProgress.userId],
      references: [users.id],
    }),
    content: one(contentLibrary, {
      fields: [userStoryProgress.contentId],
      references: [contentLibrary.id],
    }),
  }),
);

export const voiceJobsRelations = relations(voiceJobs, ({ one }) => ({
  user: one(users, {
    fields: [voiceJobs.userId],
    references: [users.id],
  }),
}));

export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
  user: one(users, {
    fields: [consentRecords.userId],
    references: [users.id],
  }),
}));

export const dataLifecycleRequestsRelations = relations(
  dataLifecycleRequests,
  ({ one }) => ({
    user: one(users, {
      fields: [dataLifecycleRequests.userId],
      references: [users.id],
    }),
  }),
);

export const invitesRelations = relations(invites, ({ one }) => ({
  inviter: one(users, {
    fields: [invites.inviterId],
    references: [users.id],
    relationName: "inviter",
  }),
}));

export const digitalActorsRelations = relations(
  digitalActors,
  ({ one, many }) => ({
    user: one(users, {
      fields: [digitalActors.userId],
      references: [users.id],
    }),
    versions: many(digitalActorVersions),
    assets: many(digitalActorAssets),
    jobs: many(digitalActorJobs),
  }),
);

export const digitalActorVersionsRelations = relations(
  digitalActorVersions,
  ({ one }) => ({
    actor: one(digitalActors, {
      fields: [digitalActorVersions.actorId, digitalActorVersions.userId],
      references: [digitalActors.id, digitalActors.userId],
    }),
    user: one(users, {
      fields: [digitalActorVersions.userId],
      references: [users.id],
    }),
  }),
);

export const digitalActorAssetsRelations = relations(
  digitalActorAssets,
  ({ one }) => ({
    actor: one(digitalActors, {
      fields: [digitalActorAssets.actorId, digitalActorAssets.userId],
      references: [digitalActors.id, digitalActors.userId],
    }),
  }),
);

export const digitalActorJobsRelations = relations(
  digitalActorJobs,
  ({ one }) => ({
    actor: one(digitalActors, {
      fields: [digitalActorJobs.actorId, digitalActorJobs.userId],
      references: [digitalActors.id, digitalActors.userId],
    }),
  }),
);
