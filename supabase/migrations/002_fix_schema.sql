-- Add missing columns to users
ALTER TABLE public.users
  ADD COLUMN videos_used int not null default 0,
  ADD COLUMN stories_used int not null default 0;

-- Update plan check constraint
ALTER TABLE public.users DROP CONSTRAINT users_plan_check;
ALTER TABLE public.users ADD CONSTRAINT users_plan_check check (plan in ('free', 'family', 'premium'));

-- Create increment_voice_slots function
CREATE OR REPLACE FUNCTION public.increment_voice_slots(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET voice_slots_used = voice_slots_used + 1
  WHERE id = user_id;
END;
$$;

-- Add content_type to content_library
ALTER TABLE public.content_library
  ADD COLUMN content_type text not null default 'video' check (content_type in ('video', 'story'));
