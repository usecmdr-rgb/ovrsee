-- Migration: Add tone and follow-up preferences to user_sync_preferences
-- Extends user_sync_preferences with AI tone presets and follow-up intensity

-- Add tone preset field
ALTER TABLE public.user_sync_preferences
ADD COLUMN IF NOT EXISTS tone_preset TEXT CHECK (tone_preset IN ('friendly', 'professional', 'direct', 'custom')) DEFAULT 'professional';

-- Add custom tone instructions (for when tone_preset = 'custom')
ALTER TABLE public.user_sync_preferences
ADD COLUMN IF NOT EXISTS tone_custom_instructions TEXT;

-- Add follow-up intensity
ALTER TABLE public.user_sync_preferences
ADD COLUMN IF NOT EXISTS follow_up_intensity TEXT CHECK (follow_up_intensity IN ('light', 'normal', 'strong')) DEFAULT 'normal';

-- Add boolean toggles for AI behavior (if not already present from previous migrations)
ALTER TABLE public.user_sync_preferences
ADD COLUMN IF NOT EXISTS prefers_auto_time_suggestions BOOLEAN DEFAULT FALSE;

-- Comments
COMMENT ON COLUMN public.user_sync_preferences.tone_preset IS 'AI tone preset: friendly, professional, direct, or custom';
COMMENT ON COLUMN public.user_sync_preferences.tone_custom_instructions IS 'Custom tone instructions when tone_preset is "custom"';
COMMENT ON COLUMN public.user_sync_preferences.follow_up_intensity IS 'Follow-up intensity: light (soft), normal, or strong (proactive)';


