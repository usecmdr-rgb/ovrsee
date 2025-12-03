-- ============================================================================
-- Migration: 20250116030000_insights_schema.sql
-- ============================================================================
-- Insights schema: insights_daily_metrics table for aggregated daily metrics
-- This table stores pre-aggregated metrics from Aloha, Sync, and Studio

-- ============================================================================
-- 1. CREATE insights_daily_metrics table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.insights_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Call metrics (from call_logs / voicemail_messages)
  calls_total INTEGER NOT NULL DEFAULT 0,
  calls_answered INTEGER NOT NULL DEFAULT 0,
  calls_missed INTEGER NOT NULL DEFAULT 0,
  calls_voicemail INTEGER NOT NULL DEFAULT 0,
  calls_duration_seconds_total INTEGER NOT NULL DEFAULT 0,
  calls_duration_seconds_avg NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Voicemail
  voicemails_total INTEGER NOT NULL DEFAULT 0,

  -- Email metrics (from sync_email_messages)
  emails_received_total INTEGER NOT NULL DEFAULT 0,
  emails_sent_total INTEGER NOT NULL DEFAULT 0,
  emails_important_total INTEGER NOT NULL DEFAULT 0,

  -- Calendar / meetings (from sync_calendar_events)
  meetings_total INTEGER NOT NULL DEFAULT 0,
  meetings_duration_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Studio metrics (from studio_*)
  studio_edits_total INTEGER NOT NULL DEFAULT 0,
  studio_posts_total INTEGER NOT NULL DEFAULT 0,
  studio_views_total INTEGER NOT NULL DEFAULT 0,
  studio_likes_total INTEGER NOT NULL DEFAULT 0,
  studio_comments_total INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One metric row per workspace per day
  UNIQUE(workspace_id, date)
);

-- ============================================================================
-- 2. CREATE indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_insights_daily_metrics_workspace_id_date
  ON public.insights_daily_metrics(workspace_id, date);

CREATE INDEX IF NOT EXISTS idx_insights_daily_metrics_date
  ON public.insights_daily_metrics(date);

-- ============================================================================
-- 3. CREATE updated_at trigger
-- ============================================================================

-- Reuse existing set_updated_at() function if it exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_insights_daily_metrics_updated_at ON public.insights_daily_metrics;
CREATE TRIGGER trigger_update_insights_daily_metrics_updated_at
  BEFORE UPDATE ON public.insights_daily_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.insights_daily_metrics ENABLE ROW LEVEL SECURITY;

-- Workspace members can view insights for their workspaces
DROP POLICY IF EXISTS "workspace_members_can_view_insights_daily_metrics" ON public.insights_daily_metrics;
CREATE POLICY "workspace_members_can_view_insights_daily_metrics"
  ON public.insights_daily_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = insights_daily_metrics.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

-- Workspace owners can insert/update insights for their workspaces
DROP POLICY IF EXISTS "workspace_owners_can_modify_insights_daily_metrics" ON public.insights_daily_metrics;
CREATE POLICY "workspace_owners_can_modify_insights_daily_metrics"
  ON public.insights_daily_metrics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = insights_daily_metrics.workspace_id
        AND w.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.insights_daily_metrics IS 'Pre-aggregated daily metrics for Insights dashboard (Aloha, Sync, Studio)';
COMMENT ON COLUMN public.insights_daily_metrics.date IS 'Date for which metrics are aggregated (YYYY-MM-DD)';
COMMENT ON COLUMN public.insights_daily_metrics.calls_answered IS 'Count of calls with status completed or in-progress';
COMMENT ON COLUMN public.insights_daily_metrics.calls_missed IS 'Count of calls with status no-answer, missed, or busy';
COMMENT ON COLUMN public.insights_daily_metrics.calls_voicemail IS 'Count of calls that have a linked voicemail_messages row';
COMMENT ON COLUMN public.insights_daily_metrics.emails_sent_total IS 'Count of emails where from_address matches workspace domain (heuristic)';
COMMENT ON COLUMN public.insights_daily_metrics.emails_important_total IS 'Count of emails with IMPORTANT label or is_important=true';



