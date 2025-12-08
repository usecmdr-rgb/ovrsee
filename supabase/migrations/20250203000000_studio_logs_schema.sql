-- ============================================================================
-- Migration: 20250203000000_studio_logs_schema.sql
-- ============================================================================
-- Add logging table for Studio operations
-- 
-- This migration adds:
-- 1. studio_logs - Stores error and warning logs for Studio operations
-- 2. Indexes for efficient queries
-- 3. RLS policies for workspace-scoped access
-- ============================================================================

-- ============================================================================
-- 1. CREATE studio_logs TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  level TEXT NOT NULL
    CONSTRAINT studio_logs_level_chk
    CHECK (level IN ('info', 'warn', 'error')),
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for workspace queries
CREATE INDEX IF NOT EXISTS idx_studio_logs_workspace_id
  ON public.studio_logs (workspace_id)
  WHERE workspace_id IS NOT NULL;

-- Index for event type queries
CREATE INDEX IF NOT EXISTS idx_studio_logs_event
  ON public.studio_logs (event);

-- Index for level filtering
CREATE INDEX IF NOT EXISTS idx_studio_logs_level
  ON public.studio_logs (level);

-- Index for time-based queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_studio_logs_created_at
  ON public.studio_logs (created_at DESC);

-- Composite index for workspace + level + time queries
CREATE INDEX IF NOT EXISTS idx_studio_logs_workspace_level_time
  ON public.studio_logs (workspace_id, level, created_at DESC)
  WHERE workspace_id IS NOT NULL;

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.studio_logs ENABLE ROW LEVEL SECURITY;

-- Workspace members can view their own logs
CREATE POLICY "Workspace members can view their logs" ON public.studio_logs
  FOR SELECT USING (
    workspace_id IS NULL OR
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_logs.workspace_id
    )
  );

-- Service role can insert logs (for background jobs)
-- Note: This allows server-side code to insert logs without RLS restrictions
-- In practice, logs are inserted via service role client
CREATE POLICY "Service role can insert logs" ON public.studio_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 3. ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE public.studio_logs IS 'Error and warning logs for Studio operations';
COMMENT ON COLUMN public.studio_logs.event IS 'Event name (e.g., "publish_failed", "llm_error")';
COMMENT ON COLUMN public.studio_logs.level IS 'Log level: info, warn, or error';
COMMENT ON COLUMN public.studio_logs.data IS 'Additional context data (JSONB)';

