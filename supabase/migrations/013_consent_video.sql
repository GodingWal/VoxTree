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
