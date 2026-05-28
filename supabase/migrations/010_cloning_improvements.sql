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
  ADD COLUMN IF NOT EXISTS elevenlabs_chars_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replicate_trainings_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replicate_inferences_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_reset_at timestamptz NOT NULL DEFAULT now();

-- Atomic increments — call from server only.
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_user_id uuid,
  p_elevenlabs_chars int DEFAULT 0,
  p_replicate_trainings int DEFAULT 0,
  p_replicate_inferences int DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET elevenlabs_chars_used = elevenlabs_chars_used + p_elevenlabs_chars,
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
  SET elevenlabs_chars_used = 0,
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

ALTER TABLE public.voice_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own jobs"
  ON public.voice_jobs FOR SELECT
  USING (auth.uid() = user_id);

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
