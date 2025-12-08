-- ============================================================================
-- Migration: 20250116040000_insight_events.sql
-- ============================================================================
-- Insight events table for tracking generated insights

-- ============================================================================
-- 1. CREATE insight_events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.insight_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,   -- e.g. 'agent_answer', 'daily_brief'
  source TEXT NOT NULL, -- e.g. 'insights_agent', 'daily_brief'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. CREATE indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_insight_events_workspace_id_created_at
  ON public.insight_events(workspace_id, created_at);

CREATE INDEX IF NOT EXISTS idx_insight_events_created_at
  ON public.insight_events(created_at);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.insight_events ENABLE ROW LEVEL SECURITY;

-- Workspace members can view insight events for their workspaces
DROP POLICY IF EXISTS "workspace_members_can_view_insight_events" ON public.insight_events;
CREATE POLICY "workspace_members_can_view_insight_events"
  ON public.insight_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = insight_events.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

-- Workspace members can insert insight events for their workspaces
DROP POLICY IF EXISTS "workspace_members_can_insert_insight_events" ON public.insight_events;
CREATE POLICY "workspace_members_can_insert_insight_events"
  ON public.insight_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = insight_events.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

-- ============================================================================
-- 4. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.insight_events IS 'Tracks insight generation events (agent answers, daily briefs, etc.)';
COMMENT ON COLUMN public.insight_events.type IS 'Type of insight event: agent_answer, daily_brief, etc.';
COMMENT ON COLUMN public.insight_events.source IS 'Source of the insight: insights_agent, daily_brief, etc.';




