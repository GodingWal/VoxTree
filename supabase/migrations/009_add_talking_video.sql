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
