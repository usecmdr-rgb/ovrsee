-- ============================================================================
-- Migration: 20250116000000_sync_schema.sql
-- ============================================================================
-- Sync schema: Extend integrations, sync jobs, Gmail/Calendar cache tables
-- This migration adds sync functionality for Gmail and Google Calendar

-- ============================================================================
-- 1) Extend integrations for sync metadata (if not already present)
-- ============================================================================

-- Add sync_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'integrations'
      AND column_name = 'sync_status'
  ) THEN
    ALTER TABLE public.integrations
    ADD COLUMN sync_status TEXT
      CONSTRAINT integrations_sync_status_chk
      CHECK (sync_status IN ('disconnected', 'connected', 'error'))
      DEFAULT 'disconnected';
  END IF;
END $$;

-- Note: last_synced_at column will be created/renamed by migration 20250116000001
-- This migration assumes last_synced_at exists (or will exist after the rename migration runs)
-- The rename migration handles: last_sync_at → last_synced_at conversion

-- ============================================================================
-- 2) Sync jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL,

  job_type TEXT NOT NULL
    CONSTRAINT sync_jobs_job_type_chk
    CHECK (job_type IN (
      'gmail_initial',
      'gmail_incremental',
      'calendar_initial',
      'calendar_incremental'
    )),

  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT sync_jobs_status_chk
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),

  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,

  from_cursor TEXT,  -- e.g. Gmail historyId / pageToken
  to_cursor TEXT,

  last_error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_workspace_id
  ON public.sync_jobs (workspace_id);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_integration_id
  ON public.sync_jobs (integration_id);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_type
  ON public.sync_jobs (status, job_type);

-- ============================================================================
-- 3) Gmail messages cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sync_email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL,

  external_id TEXT NOT NULL,     -- Gmail message or thread ID
  thread_id TEXT,                -- Gmail thread id
  from_address TEXT,
  to_addresses TEXT[],
  cc_addresses TEXT[],
  bcc_addresses TEXT[],

  subject TEXT,
  snippet TEXT,
  internal_date TIMESTAMPTZ,     -- Gmail internalDate
  labels TEXT[],

  is_read BOOLEAN DEFAULT FALSE,
  is_important BOOLEAN DEFAULT FALSE,

  raw_headers JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one message per integration+external_id
  -- Note: NULL integration_id values are considered distinct, so multiple NULLs allowed
  -- If integration_id should always be present, consider making it NOT NULL
  UNIQUE (integration_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_email_messages_workspace_id
  ON public.sync_email_messages (workspace_id);

CREATE INDEX IF NOT EXISTS idx_sync_email_messages_integration_id
  ON public.sync_email_messages (integration_id);

CREATE INDEX IF NOT EXISTS idx_sync_email_messages_internal_date
  ON public.sync_email_messages (internal_date);

-- Additional partial unique index for non-null integration_id cases
-- This ensures uniqueness when integration_id is present
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_email_messages_unique_integration
  ON public.sync_email_messages (integration_id, external_id)
  WHERE integration_id IS NOT NULL;

-- ============================================================================
-- 4) Calendar events cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sync_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL,

  external_id TEXT NOT NULL,    -- Google Calendar event id
  calendar_id TEXT,             -- Google calendar id (e.g. 'primary')
  summary TEXT,
  description TEXT,
  location TEXT,

  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,

  status TEXT DEFAULT 'confirmed'
    CONSTRAINT sync_calendar_events_status_chk
    CHECK (status IN ('confirmed', 'tentative', 'cancelled')),

  attendees JSONB DEFAULT '[]'::jsonb,
  hangout_link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one event per integration+external_id
  -- Note: NULL integration_id values are considered distinct, so multiple NULLs allowed
  -- If integration_id should always be present, consider making it NOT NULL
  UNIQUE (integration_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_calendar_events_workspace_id
  ON public.sync_calendar_events (workspace_id);

CREATE INDEX IF NOT EXISTS idx_sync_calendar_events_integration_id
  ON public.sync_calendar_events (integration_id);

CREATE INDEX IF NOT EXISTS idx_sync_calendar_events_start_at
  ON public.sync_calendar_events (start_at);

-- Additional partial unique index for non-null integration_id cases
-- This ensures uniqueness when integration_id is present
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_calendar_events_unique_integration
  ON public.sync_calendar_events (integration_id, external_id)
  WHERE integration_id IS NOT NULL;

-- ============================================================================
-- 5) Updated_at trigger function (reusable)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6) Triggers for updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS set_timestamp_sync_jobs ON public.sync_jobs;
CREATE TRIGGER set_timestamp_sync_jobs
  BEFORE UPDATE ON public.sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_timestamp_sync_email_messages ON public.sync_email_messages;
CREATE TRIGGER set_timestamp_sync_email_messages
  BEFORE UPDATE ON public.sync_email_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_timestamp_sync_calendar_events ON public.sync_calendar_events;
CREATE TRIGGER set_timestamp_sync_calendar_events
  BEFORE UPDATE ON public.sync_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 7) ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_calendar_events ENABLE ROW LEVEL SECURITY;

-- Sync jobs policies
DROP POLICY IF EXISTS "workspace_members_can_view_sync_jobs" ON public.sync_jobs;
CREATE POLICY "workspace_members_can_view_sync_jobs"
  ON public.sync_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = sync_jobs.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "workspace_owners_can_modify_sync_jobs" ON public.sync_jobs;
CREATE POLICY "workspace_owners_can_modify_sync_jobs"
  ON public.sync_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = sync_jobs.workspace_id
        AND w.owner_user_id = auth.uid()
    )
  );

-- Sync email messages policies
DROP POLICY IF EXISTS "workspace_members_can_view_sync_email_messages" ON public.sync_email_messages;
CREATE POLICY "workspace_members_can_view_sync_email_messages"
  ON public.sync_email_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = sync_email_messages.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "workspace_owners_can_modify_sync_email_messages" ON public.sync_email_messages;
CREATE POLICY "workspace_owners_can_modify_sync_email_messages"
  ON public.sync_email_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = sync_email_messages.workspace_id
        AND w.owner_user_id = auth.uid()
    )
  );

-- Sync calendar events policies
DROP POLICY IF EXISTS "workspace_members_can_view_sync_calendar_events" ON public.sync_calendar_events;
CREATE POLICY "workspace_members_can_view_sync_calendar_events"
  ON public.sync_calendar_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = sync_calendar_events.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "workspace_owners_can_modify_sync_calendar_events" ON public.sync_calendar_events;
CREATE POLICY "workspace_owners_can_modify_sync_calendar_events"
  ON public.sync_calendar_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = sync_calendar_events.workspace_id
        AND w.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- 8) COMMENTS
-- ============================================================================

COMMENT ON TABLE public.sync_jobs IS 'Tracks sync job execution for Gmail and Calendar integrations';
COMMENT ON TABLE public.sync_email_messages IS 'Cached Gmail messages synced from Google';
COMMENT ON TABLE public.sync_calendar_events IS 'Cached Google Calendar events synced from Google';
COMMENT ON COLUMN public.integrations.sync_status IS 'Sync connection status: disconnected, connected, or error';
COMMENT ON COLUMN public.integrations.last_synced_at IS 'Timestamp of the last successful sync operation for this integration';
COMMENT ON COLUMN public.sync_jobs.job_type IS 'Type of sync job: gmail_initial, gmail_incremental, calendar_initial, calendar_incremental';
COMMENT ON COLUMN public.sync_jobs.status IS 'Job execution status: pending, running, completed, failed';
COMMENT ON COLUMN public.sync_email_messages.integration_id IS 'Integration that synced this message. NULL values are allowed but may allow duplicates.';
COMMENT ON COLUMN public.sync_calendar_events.integration_id IS 'Integration that synced this event. NULL values are allowed but may allow duplicates.';

