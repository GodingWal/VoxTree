-- Migration 006: Children and Bedtime Settings

-- Create family children table
CREATE TABLE IF NOT EXISTS public.family_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  age int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on family_children
ALTER TABLE public.family_children ENABLE ROW LEVEL SECURITY;

-- Create policies for family_children
CREATE POLICY "Users can view own children"
  ON public.family_children FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own children"
  ON public.family_children FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own children"
  ON public.family_children FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own children"
  ON public.family_children FOR DELETE
  USING (auth.uid() = user_id);

-- Enable trigger to automatically update updated_at for family_children
CREATE TRIGGER family_children_updated_at
  BEFORE UPDATE ON public.family_children
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add Bedtime and Background settings to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bedtime_time text NOT NULL DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS bedtime_autodim boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_background_audio text NOT NULL DEFAULT 'soft_rain';

-- Add consent_verified to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS consent_verified boolean NOT NULL DEFAULT false;
