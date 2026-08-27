-- Migration 011: Sync Voice Slots and Database-backed Rate Limits

-- 1. Create rate_limits table for serverless-ready IP rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  count int NOT NULL DEFAULT 1,
  reset_at timestamptz NOT NULL
);

-- Enable RLS on rate_limits (only admins/service-role can access/modify directly)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

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
