-- Migration: Extend user_sync_preferences for smart scheduling
-- Adds preferences for time slot suggestions and meeting duration

ALTER TABLE public.user_sync_preferences
ADD COLUMN IF NOT EXISTS prefers_auto_time_suggestions BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS default_meeting_duration_minutes INTEGER DEFAULT 60 CHECK (default_meeting_duration_minutes > 0),
ADD COLUMN IF NOT EXISTS scheduling_time_window_days INTEGER DEFAULT 7 CHECK (scheduling_time_window_days >= 1 AND scheduling_time_window_days <= 30);

COMMENT ON COLUMN public.user_sync_preferences.prefers_auto_time_suggestions IS 'Whether to automatically suggest time slots in AI drafts';
COMMENT ON COLUMN public.user_sync_preferences.default_meeting_duration_minutes IS 'Default meeting duration for time slot suggestions (e.g., 30, 60)';
COMMENT ON COLUMN public.user_sync_preferences.scheduling_time_window_days IS 'Number of days ahead to look for available time slots (1-30)';


