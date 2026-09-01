-- Auditable parental consent and voice-owner authorization.

CREATE TABLE IF NOT EXISTS public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consent records"
  ON public.consent_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consent records"
  ON public.consent_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

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
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('export', 'delete', 'revoke_consent')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'completed', 'failed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  failure_reason text
);

ALTER TABLE public.data_lifecycle_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lifecycle requests"
  ON public.data_lifecycle_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own lifecycle requests"
  ON public.data_lifecycle_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
