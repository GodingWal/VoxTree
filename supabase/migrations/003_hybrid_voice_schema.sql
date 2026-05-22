-- Add RVC columns to family_voices
ALTER TABLE public.family_voices 
ADD COLUMN rvc_model_id TEXT DEFAULT NULL,
ADD COLUMN rvc_training_status TEXT DEFAULT NULL;

-- Add ContentMode and RVC fields to content_library
ALTER TABLE public.content_library
ADD COLUMN content_mode TEXT DEFAULT 'tts' NOT NULL,
ADD COLUMN text_script TEXT DEFAULT NULL,
ADD COLUMN isolated_vocals_url TEXT DEFAULT NULL,
ADD COLUMN instrumental_url TEXT DEFAULT NULL;

-- Validate content_mode
ALTER TABLE public.content_library
ADD CONSTRAINT content_mode_check CHECK (content_mode IN ('tts', 'v2v'));
