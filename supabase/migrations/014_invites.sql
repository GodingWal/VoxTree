-- Grandparent invite tracking used by the family dashboard viral loop.

CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email text,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_inviter_created
  ON public.invites(inviter_id, created_at DESC);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own invites" ON public.invites;
CREATE POLICY "Users can read own invites"
  ON public.invites FOR SELECT
  USING (auth.uid() = inviter_id);

DROP POLICY IF EXISTS "Users can create own invites" ON public.invites;
CREATE POLICY "Users can create own invites"
  ON public.invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

DROP POLICY IF EXISTS "Users can update own invites" ON public.invites;
CREATE POLICY "Users can update own invites"
  ON public.invites FOR UPDATE
  USING (auth.uid() = inviter_id)
  WITH CHECK (auth.uid() = inviter_id);
