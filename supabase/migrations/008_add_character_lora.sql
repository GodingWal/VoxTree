-- Personalized character LoRA for Pixar-style identity clones.
--
-- A LoRA is trained per voice/family-member from a handful of reference
-- photos. Inference stacks the user's identity LoRA with a Pixar style LoRA
-- to produce the truest possible Pixar clone — far more faithful than a
-- one-shot face-to-many pass.
ALTER TABLE public.family_voices
  ADD COLUMN IF NOT EXISTS lora_training_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lora_destination TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lora_version TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lora_weights_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lora_trigger_word TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lora_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS character_reference_images JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS family_voices_lora_training_id_idx
  ON public.family_voices (lora_training_id)
  WHERE lora_training_id IS NOT NULL;
