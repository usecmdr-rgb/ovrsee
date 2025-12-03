-- Google Calendar Event Mapping Table
-- Maps OVRSEE events to Google Calendar events for two-way sync
CREATE TABLE IF NOT EXISTS calendar_event_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ovrsee_event_id TEXT NOT NULL, -- OVRSEE event identifier
  google_event_id TEXT NOT NULL, -- Google Calendar event ID
  calendar_id TEXT NOT NULL DEFAULT 'primary', -- Google Calendar ID
  etag TEXT, -- Google event etag for change detection
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, google_event_id),
  UNIQUE(user_id, ovrsee_event_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_user_id ON calendar_event_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_google_event_id ON calendar_event_mappings(google_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_ovrsee_event_id ON calendar_event_mappings(ovrsee_event_id);

-- Soft Delete Support for Calendar Events
-- Add columns to existing calendar_event_notes table (or create new events table)
-- Note: This assumes events are stored in calendar_event_notes. Adjust table name as needed.

ALTER TABLE calendar_event_notes 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS deleted_source TEXT CHECK (deleted_source IN ('ovrsee', 'google', 'system'));

CREATE INDEX IF NOT EXISTS idx_calendar_event_notes_deleted_at ON calendar_event_notes(deleted_at) WHERE deleted_at IS NOT NULL;

-- Google Calendar Connection (already exists, but ensure it has all needed fields)
-- Ensure calendar_connections table has:
-- - user_id
-- - access_token
-- - refresh_token
-- - expires_at
-- - calendar_id (default: 'primary')
-- - sync_enabled (boolean, default: true)
-- - last_sync_at (timestamp)
-- - sync_direction (text: 'two-way', 'ovrsee-to-google', 'google-to-ovrsee')

-- Retention Policy: Automatically purge soft-deleted events after 60 days
-- This should be run as a scheduled job (cron) or database function
CREATE OR REPLACE FUNCTION purge_old_deleted_events()
RETURNS void AS $$
BEGIN
  DELETE FROM calendar_event_notes
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql;



