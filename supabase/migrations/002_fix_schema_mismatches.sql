-- VoxTree Migration: Fix schema mismatches between DB and application code
-- Addresses issues 0a, 0b, 0c from CODE-REVIEW-RECOMMENDATIONS.md

-- ============================================================
-- 0a. Fix plan constraint: add 'premium', remove 'pro'
-- ============================================================

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_plan_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_plan_check
    CHECK (plan IN ('free', 'family', 'premium'));

-- Migrate any existing 'pro' rows to 'premium'
UPDATE public.users SET plan = 'premium' WHERE plan = 'pro';

-- ============================================================
-- 0a. Replace clips_used_this_month with videos_used / stories_used
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS videos_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stories_used int NOT NULL DEFAULT 0;

-- Drop the old monthly-reset columns (no longer used by application code)
ALTER TABLE public.users
  DROP COLUMN IF EXISTS clips_used_this_month,
  DROP COLUMN IF EXISTS clips_reset_at;

-- ============================================================
-- 0b. Add increment_voice_slots RPC function
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_voice_slots(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.users
  SET voice_slots_used = voice_slots_used + 1
  WHERE id = user_id;
END;
$$;

-- ============================================================
-- 0b. Add increment helpers for content usage tracking
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_videos_used(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.users
  SET videos_used = videos_used + 1
  WHERE id = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_stories_used(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.users
  SET stories_used = stories_used + 1
  WHERE id = user_id;
END;
$$;

-- ============================================================
-- 0c. Add content_type column to content_library
-- ============================================================

ALTER TABLE public.content_library
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'video'
    CHECK (content_type IN ('video', 'story'));

CREATE INDEX IF NOT EXISTS idx_content_library_type
  ON public.content_library(content_type);
