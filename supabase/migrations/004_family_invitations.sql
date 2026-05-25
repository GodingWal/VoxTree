-- Create family invitations table
CREATE TABLE IF NOT EXISTS public.family_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT null REFERENCES public.users(id) ON DELETE CASCADE,
  email text NOT null,
  status text NOT null DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT null DEFAULT now(),
  updated_at timestamptz NOT null DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own family invitations"
  ON public.family_invitations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own family invitations"
  ON public.family_invitations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own family invitations"
  ON public.family_invitations FOR DELETE
  USING (auth.uid() = user_id);

-- Enable trigger to automatically update updated_at
CREATE TRIGGER family_invitations_updated_at
  BEFORE UPDATE ON public.family_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
