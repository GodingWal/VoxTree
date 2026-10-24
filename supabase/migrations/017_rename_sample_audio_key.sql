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
