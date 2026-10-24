-- VoxTree local schema, ported from supabase/migrations 001-018 (Oct 24, 2026)
-- Supabase removals: RLS policies (see db/rls-policy-map.md), auth.users FKs/trigger.
-- Auth.js (Phase 3, appended at end of file) adds: email, email_verified,
-- image, password_hash on users + accounts/sessions/verification_tokens tables.
create extension if not exists pgcrypto;

-- ===== 001_initial_schema.sql =====
-- VoxTree Initial Schema
-- Creates core tables for users, voices, content, and generated clips

-- ============================================================
-- TABLES
-- ============================================================

-- App-owned users table (was: extends Supabase auth.users)
create table public.users (
  id uuid primary key default gen_random_uuid(),
  name text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'family')),
  voice_slots_used int not null default 0,
  clips_used_this_month int not null default 0,
  clips_reset_at timestamptz not null default now(),
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Family member voice clones
create table public.family_voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  provider_voice_id text,
  sample_audio_url text,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Curated content library (videos, stories)
create table public.content_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  series text,
  episode_number int,
  original_video_url text not null,
  thumbnail_url text,
  duration_seconds int,
  age_range text,
  tags text[] default '{}',
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

-- Generated clips (voice-replaced videos)
create table public.generated_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content_id uuid not null references public.content_library(id) on delete cascade,
  voice_id uuid not null references public.family_voices(id) on delete cascade,
  output_audio_url text,
  output_video_url text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'failed')),
  cached boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_family_voices_user_id on public.family_voices(user_id);
create index idx_generated_clips_user_id on public.generated_clips(user_id);
create index idx_generated_clips_cache_lookup on public.generated_clips(content_id, voice_id, status);
create index idx_content_library_series on public.content_library(series);
create index idx_content_library_premium on public.content_library(is_premium);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- [RLS enable removed]
-- [RLS enable removed]
-- [RLS enable removed]
-- [RLS enable removed]

-- Users: can read and update their own row
-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- Family voices: users can CRUD their own voices
-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- Content library: all authenticated users can read
-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- Generated clips: users can CRUD their own clips
-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create public.users row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

-- [auth.users trigger removed: app creates the users row at signup]

-- Auto-update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.update_updated_at();

create trigger family_voices_updated_at
  before update on public.family_voices
  for each row execute function public.update_updated_at();

create trigger generated_clips_updated_at
  before update on public.generated_clips
  for each row execute function public.update_updated_at();

-- ===== 002_fix_schema.sql =====
-- Add missing columns to users
ALTER TABLE public.users
  ADD COLUMN videos_used int not null default 0,
  ADD COLUMN stories_used int not null default 0;

-- Update plan check constraint
ALTER TABLE public.users DROP CONSTRAINT users_plan_check;
ALTER TABLE public.users ADD CONSTRAINT users_plan_check check (plan in ('free', 'family', 'premium'));

-- Create increment_voice_slots function
CREATE OR REPLACE FUNCTION public.increment_voice_slots(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET voice_slots_used = voice_slots_used + 1
  WHERE id = user_id;
END;
$$;

-- Add content_type to content_library
ALTER TABLE public.content_library
  ADD COLUMN content_type text not null default 'video' check (content_type in ('video', 'story'));

-- ===== 003_hybrid_voice_schema.sql =====
-- Add RVC columns to family_voices
ALTER TABLE public.family_voices 
ADD COLUMN rvc_model_id TEXT DEFAULT NULL,
ADD COLUMN rvc_training_status TEXT DEFAULT NULL;

-- Add ContentMode and RVC fields to content_library
ALTER TABLE public.content_library
ADD COLUMN content_mode TEXT DEFAULT 'tts' NOT NULL,
ADD COLUMN text_script TEXT DEFAULT NULL,
ADD COLUMN isolated_vocals_url TEXT DEFAULT NULL,
ADD COLUMN instrumental_url TEXT DEFAULT NULL;

-- Validate content_mode
ALTER TABLE public.content_library
ADD CONSTRAINT content_mode_check CHECK (content_mode IN ('tts', 'v2v'));

-- ===== 004_family_invitations.sql =====
-- Create family invitations table
CREATE TABLE IF NOT EXISTS public.family_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT null REFERENCES public.users(id) ON DELETE CASCADE,
  email text NOT null,
  status text NOT null DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT null DEFAULT now(),
  updated_at timestamptz NOT null DEFAULT now()
);

-- Enable RLS
-- [RLS enable removed]

-- Create policies
-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- Enable trigger to automatically update updated_at
CREATE TRIGGER family_invitations_updated_at
  BEFORE UPDATE ON public.family_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===== 005_add_visual_cloning_columns.sql =====
-- Add visual cloning columns to family_voices table
ALTER TABLE public.family_voices 
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS idle_video_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS talking_video_url TEXT DEFAULT NULL;

-- Add avatar_url to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- ===== 006_children_and_bedtime.sql =====
-- Migration 006: Children and Bedtime Settings

-- Create family children table
CREATE TABLE IF NOT EXISTS public.family_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  age int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on family_children
-- [RLS enable removed]

-- Create policies for family_children
-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- Enable trigger to automatically update updated_at for family_children
CREATE TRIGGER family_children_updated_at
  BEFORE UPDATE ON public.family_children
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add Bedtime and Background settings to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bedtime_time text NOT NULL DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS bedtime_autodim boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_background_audio text NOT NULL DEFAULT 'soft_rain';

-- Add consent_verified to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS consent_verified boolean NOT NULL DEFAULT false;

-- ===== 007_library_enhancements.sql =====
-- Library Enhancements Migration
-- Adds: synopsis column, user_saved_stories table, user_story_progress table

-- ============================================================
-- 1. Add synopsis column to content_library
-- ============================================================
ALTER TABLE public.content_library
  ADD COLUMN IF NOT EXISTS synopsis text;

-- ============================================================
-- 2. User saved stories (persisted library selections)
-- ============================================================
CREATE TABLE public.user_saved_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.content_library(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

CREATE INDEX idx_user_saved_stories_user ON public.user_saved_stories(user_id);
CREATE INDEX idx_user_saved_stories_content ON public.user_saved_stories(content_id);

-- [RLS enable removed]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- ============================================================
-- 3. User story progress (listening/reading tracking)
-- ============================================================
CREATE TABLE public.user_story_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.content_library(id) ON DELETE CASCADE,
  progress_seconds int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  last_played_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

CREATE INDEX idx_user_story_progress_user ON public.user_story_progress(user_id);

-- [RLS enable removed]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

CREATE TRIGGER user_story_progress_updated_at
  BEFORE UPDATE ON public.user_story_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===== 008_add_character_lora.sql =====
-- Personalized character LoRA for Pixar-style identity clones.
--
-- A LoRA is trained per voice/family-member from a handful of reference
-- photos. Inference stacks the user's identity LoRA with a Pixar style LoRA
-- to produce the truest possible Pixar clone — far more faithful than a
-- one-shot face-to-many pass.
ALTER TABLE public.family_voices
  ADD COLUMN IF NOT EXISTS lora_training_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lora_destination TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lora_version TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lora_weights_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lora_trigger_word TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lora_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS character_reference_images JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS family_voices_lora_training_id_idx
  ON public.family_voices (lora_training_id)
  WHERE lora_training_id IS NOT NULL;

-- ===== 009_add_talking_video.sql =====
-- Track Hedra Character-3 talking-head generations so the clone-details UI
-- can show status and the final video URL.
ALTER TABLE public.generated_clips
  ADD COLUMN IF NOT EXISTS hedra_generation_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS talking_video_url TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS generated_clips_hedra_generation_id_idx
  ON public.generated_clips (hedra_generation_id)
  WHERE hedra_generation_id IS NOT NULL;

-- Talking-head clips originate from user-typed text, not the content library,
-- so a generated_clips row can exist without a content_id.
ALTER TABLE public.generated_clips
  ALTER COLUMN content_id DROP NOT NULL;

-- ===== 010_cloning_improvements.sql =====
-- Cloning process hardening.
--
-- Adds:
--   1. decrement_voice_slots() RPC, mirroring increment_voice_slots()
--   2. Cost tracking columns on users (monthly external-API usage)
--   3. voice_jobs durable queue for resumable async work
--   4. Idempotency/hash columns on family_voices
--   5. cancelled training status

-- 1. Decrement voice slots when a voice is deleted.
CREATE OR REPLACE FUNCTION public.decrement_voice_slots(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET voice_slots_used = GREATEST(voice_slots_used - 1, 0)
  WHERE id = user_id;
END;
$$;

-- 2. Per-user external-API cost tracking. Counters are reset monthly by the
-- caller (lib/cost-tracking.ts) when usage_reset_at falls in a prior month.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tts_chars_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replicate_trainings_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replicate_inferences_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_reset_at timestamptz NOT NULL DEFAULT now();

-- Atomic increments — call from server only.
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_user_id uuid,
  p_tts_chars int DEFAULT 0,
  p_replicate_trainings int DEFAULT 0,
  p_replicate_inferences int DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET tts_chars_used = tts_chars_used + p_tts_chars,
      replicate_trainings_used = replicate_trainings_used + p_replicate_trainings,
      replicate_inferences_used = replicate_inferences_used + p_replicate_inferences
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_usage_if_stale(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET tts_chars_used = 0,
      replicate_trainings_used = 0,
      replicate_inferences_used = 0,
      usage_reset_at = now()
  WHERE id = p_user_id
    AND date_trunc('month', usage_reset_at) < date_trunc('month', now());
END;
$$;

-- 3. Durable job queue. Each cloning step (clone → mix → upload) is a job
-- that a worker picks up via lease_voice_job(). Workers acquire a lease
-- atomically and must finish before locked_until or another worker can
-- pick the job up.
CREATE TABLE IF NOT EXISTS public.voice_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'voice_clone',
    'singing_train',
    'clip_generate',
    'talking_video',
    'lora_train'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued',
    'running',
    'succeeded',
    'failed',
    'cancelled'
  )),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  last_error text,
  locked_until timestamptz,
  worker_id text,
  result jsonb,
  -- Idempotency: prevents the same job being enqueued twice from a retry.
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_voice_jobs_status_locked
  ON public.voice_jobs (status, locked_until)
  WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS idx_voice_jobs_user ON public.voice_jobs (user_id);

-- [RLS enable removed]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

CREATE TRIGGER voice_jobs_updated_at
  BEFORE UPDATE ON public.voice_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Atomic lease: picks the oldest queued/expired job and marks it running.
-- Returns the job row (or no rows if the queue is empty).
CREATE OR REPLACE FUNCTION public.lease_voice_job(
  p_worker_id text,
  p_lease_seconds int DEFAULT 300
)
RETURNS SETOF public.voice_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.voice_jobs
  SET status = 'running',
      worker_id = p_worker_id,
      locked_until = now() + (p_lease_seconds || ' seconds')::interval,
      attempts = attempts + 1
  WHERE id = (
    SELECT id FROM public.voice_jobs
    WHERE (status = 'queued')
       OR (status = 'running' AND locked_until < now())
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- 4. Idempotency hash on the audio sample so we can short-circuit a
-- re-clone of an identical file (e.g. user re-uploads same audio).
ALTER TABLE public.family_voices
  ADD COLUMN IF NOT EXISTS sample_sha256 text,
  ADD COLUMN IF NOT EXISTS sample_duration_seconds numeric,
  ADD COLUMN IF NOT EXISTS sample_bytes bigint;

CREATE INDEX IF NOT EXISTS idx_family_voices_sample_sha256
  ON public.family_voices (sample_sha256)
  WHERE sample_sha256 IS NOT NULL;

-- 5. Allow 'cancelled' as an rvc_training_status value. The column has no
-- check constraint today (it's a free-form text), but documenting here so
-- the application surface is explicit.
COMMENT ON COLUMN public.family_voices.rvc_training_status IS
  'One of: processing | ready | failed | cancelled';

-- ===== 011_sync_slots_and_rate_limits.sql =====
-- Migration 011: Sync Voice Slots and Database-backed Rate Limits

-- 1. Create rate_limits table for serverless-ready IP rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  count int NOT NULL DEFAULT 1,
  reset_at timestamptz NOT NULL
);

-- Enable RLS on rate_limits (only admins/service-role can access/modify directly)
-- [RLS enable removed]

-- 2. Create atomic rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_ms int
)
RETURNS boolean AS $$
DECLARE
  v_count int;
  v_reset_at timestamptz;
  v_now timestamptz := now();
BEGIN
  -- Clean up expired entries in the same call to keep table size bounded
  DELETE FROM public.rate_limits WHERE reset_at < v_now;

  -- Select current rate limit count & reset time
  SELECT count, reset_at INTO v_count, v_reset_at
  FROM public.rate_limits
  WHERE key = p_key;

  IF NOT FOUND THEN
    -- First request or window expired: insert new window
    INSERT INTO public.rate_limits (key, count, reset_at)
    VALUES (p_key, 1, v_now + (p_window_ms || ' milliseconds')::interval)
    ON CONFLICT (key) DO UPDATE
    SET count = 1, reset_at = EXCLUDED.reset_at;
    RETURN TRUE;
  ELSIF v_count >= p_limit THEN
    -- Limit reached
    RETURN FALSE;
  ELSE
    -- Increment count
    UPDATE public.rate_limits
    SET count = count + 1
    WHERE key = p_key;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create synchronization triggers for voice_slots_used
CREATE OR REPLACE FUNCTION public.sync_voice_slots()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users
    SET voice_slots_used = voice_slots_used + 1
    WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users
    SET voice_slots_used = GREATEST(0, voice_slots_used - 1)
    WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_sync_voice_slots
AFTER INSERT OR DELETE ON public.family_voices
FOR EACH ROW EXECUTE FUNCTION public.sync_voice_slots();

-- 4. Align existing counters in users table based on actual count in family_voices
UPDATE public.users u
SET voice_slots_used = (
  SELECT COALESCE(COUNT(*), 0)
  FROM public.family_voices f
  WHERE f.user_id = u.id
);

-- ===== 012_consent_and_data_lifecycle.sql =====
-- Auditable parental consent and voice-owner authorization.

CREATE TABLE IF NOT EXISTS public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notice_version text NOT NULL,
  parent_name text NOT NULL,
  parent_relationship text NOT NULL,
  signature_sha256 text NOT NULL,
  voice_owner_authorization_confirmed boolean NOT NULL DEFAULT false,
  ip_sha256 text,
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS consent_records_user_id_idx
  ON public.consent_records(user_id, accepted_at DESC);

-- [RLS enable removed]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS consent_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_notice_version text;

ALTER TABLE public.family_voices
  ADD COLUMN IF NOT EXISTS voice_owner_name text,
  ADD COLUMN IF NOT EXISTS voice_owner_relationship text,
  ADD COLUMN IF NOT EXISTS voice_owner_authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS authorization_notice_version text;

CREATE TABLE IF NOT EXISTS public.data_lifecycle_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('export', 'delete', 'revoke_consent')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'completed', 'failed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  failure_reason text
);

-- [RLS enable removed]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- ===== 013_consent_video.sql =====
-- Consent video proof + revocation wiring (P0 #2).
-- Extends 012_consent_and_data_lifecycle with video proof material and
-- a verified_at timestamp so revocation/purge can be audited.

ALTER TABLE public.consent_records
  ADD COLUMN IF NOT EXISTS video_gcs_key text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Index for efficient lookup of verified consents per user
CREATE INDEX IF NOT EXISTS consent_records_video_gcs_key_idx
  ON public.consent_records(video_gcs_key)
  WHERE video_gcs_key IS NOT NULL;

-- Ensure revoked_at remains nullable (already added in 012) and add comment
COMMENT ON COLUMN public.consent_records.video_gcs_key IS 'GCS key of 30s video selfie proof, e.g. consent-videos/<user_id>/<consent_id>.webm';
COMMENT ON COLUMN public.consent_records.verified_at IS 'Set when video proof (or other verification) was accepted; null until verified';

-- ===== 014_invites.sql =====
-- Grandparent invite tracking used by the family dashboard viral loop.

CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_email text,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_inviter_created
  ON public.invites(inviter_id, created_at DESC);

-- [RLS enable removed]

DROP POLICY IF EXISTS "Users can read own invites" ON public.invites;
-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

DROP POLICY IF EXISTS "Users can create own invites" ON public.invites;
-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

DROP POLICY IF EXISTS "Users can update own invites" ON public.invites;
-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- ===== 015_digital_actors.sql =====
-- Identities are versioned independently from movie characters.
create table public.digital_actors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  status text not null default 'capture_required' check (status in ('capture_required','processing','ready','failed')),
  identity jsonb not null,
  consent jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id)
);
create table public.digital_actor_versions (
  actor_id uuid not null references public.digital_actors(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  version integer not null check(version > 0),
  identity jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,version),
  foreign key(actor_id,user_id) references public.digital_actors(id,user_id) on delete cascade
);
create table public.digital_actor_assets (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  user_id uuid not null,
  actor_version integer not null check(actor_version > 0),
  kind text not null check(kind in ('face','body','voice','hair','skin','realistic','stylized','preview','production')),
  storage_key text not null unique,
  content_type text not null,
  bytes bigint not null check(bytes > 0),
  model_id text,
  model_version text,
  dependencies uuid[] not null default '{}',
  foreign key(actor_id,user_id) references public.digital_actors(id,user_id) on delete cascade
);
create table public.digital_actor_jobs (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null, user_id uuid not null,
  actor_version integer not null check(actor_version > 0),
  stage text not null check(stage in ('CAPTURE_PROCESS','FACE_RECONSTRUCT','BODY_RECONSTRUCT','AVATAR_BUILD','AVATAR_STYLIZE','PREVIEW_GENERATE','RENDER_PACKAGE_GENERATE')),
  status text not null default 'queued' check(status in ('queued','running','completed','failed','retrying')),
  attempts integer not null default 0, max_attempts integer not null default 3,
  lease_token uuid, locked_until timestamptz, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(actor_id,actor_version,stage),
  foreign key(actor_id,user_id) references public.digital_actors(id,user_id) on delete cascade
);
create index digital_actor_jobs_pending on public.digital_actor_jobs(status,created_at);
-- [RLS enable removed]
-- [RLS enable removed]
-- [RLS enable removed]
-- [RLS enable removed]
-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]
-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]
-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]
-- [RLS policy removed -> app-level check, see db/rls-policy-map.md]

-- ===== 016_adult_attestation.sql =====
-- Adult-only capture policy: record the 18+ attestation with each consent.
ALTER TABLE public.consent_records
  ADD COLUMN IF NOT EXISTS adult_confirmed_at timestamptz;

-- ===== 017_rename_sample_audio_key.sql =====
-- family_voices.sample_audio_url stores an object key (presigned URLs expire),
-- so name the column accordingly. Idempotent: no-op once renamed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'family_voices' AND column_name = 'sample_audio_url'
  ) THEN
    ALTER TABLE public.family_voices RENAME COLUMN sample_audio_url TO sample_audio_key;
  END IF;
END $$;

-- ===== 018_require_adult_reconsent.sql =====
-- Accounts that consented before the 18+ attestation (migration 016) have no
-- attested consent record. Reset their flag so they re-consent via /consent;
-- the guard in lib/consent.ts enforces the same rule at runtime.
UPDATE public.users u
SET consent_verified = false
WHERE u.consent_verified = true
  AND NOT EXISTS (
    SELECT 1 FROM public.consent_records c
    WHERE c.user_id = u.id
      AND c.revoked_at IS NULL
      AND c.adult_confirmed_at IS NOT NULL
  );

-- ===== Phase 3 — Auth.js identity tables (Supabase removal) =====
-- Auth.js (NextAuth v5) + Drizzle adapter replaces Supabase Auth.
-- `users` gains the identity columns the adapter expects; `password_hash`
-- stays NULL for OAuth-only accounts. Password-reset tokens live in
-- verification_tokens under the identifier `password-reset:<email>`
-- (see lib/auth/password-reset.ts). Sessions use JWT, so the sessions
-- table exists for adapter completeness / future database sessions.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash text;
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

CREATE TABLE IF NOT EXISTS public.accounts (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  PRIMARY KEY (provider, provider_account_id)
);
CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON public.accounts (user_id);

CREATE TABLE IF NOT EXISTS public.sessions (
  session_token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.verification_tokens (
  identifier text NOT NULL,
  token text NOT NULL,
  expires timestamptz NOT NULL,
  PRIMARY KEY (identifier, token)
);
