-- Adult-only capture policy: record the 18+ attestation with each consent.
ALTER TABLE public.consent_records
  ADD COLUMN IF NOT EXISTS adult_confirmed_at timestamptz;
