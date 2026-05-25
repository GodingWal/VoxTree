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

ALTER TABLE public.user_saved_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved stories"
  ON public.user_saved_stories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved stories"
  ON public.user_saved_stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved stories"
  ON public.user_saved_stories FOR DELETE
  USING (auth.uid() = user_id);

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

ALTER TABLE public.user_story_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own progress"
  ON public.user_story_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.user_story_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.user_story_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER user_story_progress_updated_at
  BEFORE UPDATE ON public.user_story_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
