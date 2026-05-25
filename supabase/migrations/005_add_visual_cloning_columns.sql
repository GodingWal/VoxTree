-- Add visual cloning columns to family_voices table
ALTER TABLE public.family_voices 
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS idle_video_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS talking_video_url TEXT DEFAULT NULL;

-- Add avatar_url to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;
