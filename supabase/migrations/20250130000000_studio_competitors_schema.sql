-- ============================================================================
-- Migration: 20250130000000_studio_competitors_schema.sql
-- ============================================================================
-- Add competitor tracking: competitors table and metrics snapshots
-- 
-- This migration adds:
-- 1. studio_competitors - Declared competitor accounts per workspace
-- 2. studio_competitor_metrics - Time-series metrics snapshots
-- ============================================================================

-- ============================================================================
-- 1. CREATE studio_competitors TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL
    CONSTRAINT studio_competitors_platform_chk
    CHECK (platform IN ('instagram', 'tiktok', 'facebook')),
  handle TEXT NOT NULL,
  label TEXT, -- User-friendly name (optional)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT unique_competitor_per_workspace UNIQUE (workspace_id, platform, handle)
);

-- Index for workspace queries
CREATE INDEX IF NOT EXISTS idx_studio_competitors_workspace_id
  ON public.studio_competitors (workspace_id);

-- Index for platform filtering
CREATE INDEX IF NOT EXISTS idx_studio_competitors_platform
  ON public.studio_competitors (workspace_id, platform);

-- ============================================================================
-- 2. CREATE studio_competitor_metrics TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_competitor_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.studio_competitors(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  followers BIGINT,
  posts_count BIGINT,
  avg_engagement_estimate NUMERIC(10, 2), -- Optional approximation (percentage)
  metadata JSONB DEFAULT '{}'::jsonb, -- For additional platform-specific data

  CONSTRAINT unique_competitor_metric_snapshot UNIQUE (competitor_id, captured_at)
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_studio_competitor_metrics_competitor_captured
  ON public.studio_competitor_metrics (competitor_id, captured_at DESC);

-- Index for latest metrics lookup
CREATE INDEX IF NOT EXISTS idx_studio_competitor_metrics_latest
  ON public.studio_competitor_metrics (competitor_id, captured_at DESC)
  WHERE captured_at IS NOT NULL;

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.studio_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view their competitors" ON public.studio_competitors
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_competitors.workspace_id
    )
  );

CREATE POLICY "Workspace members can insert their competitors" ON public.studio_competitors
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_competitors.workspace_id
    )
  );

CREATE POLICY "Workspace members can update their competitors" ON public.studio_competitors
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_competitors.workspace_id
    )
  );

CREATE POLICY "Workspace members can delete their competitors" ON public.studio_competitors
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_competitors.workspace_id
    )
  );

ALTER TABLE public.studio_competitor_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view competitor metrics" ON public.studio_competitor_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.studio_competitors c
      WHERE c.id = competitor_id
      AND auth.uid() IN (
        SELECT user_id FROM public.workspace_members 
        WHERE workspace_id = c.workspace_id
      )
    )
  );

-- ============================================================================
-- 4. ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE public.studio_competitors IS 'Competitor accounts tracked per workspace';
COMMENT ON COLUMN public.studio_competitors.handle IS 'Platform username/identifier (e.g., @username)';
COMMENT ON COLUMN public.studio_competitors.label IS 'User-friendly name for the competitor';
COMMENT ON TABLE public.studio_competitor_metrics IS 'Time-series metrics snapshots for competitors';
COMMENT ON COLUMN public.studio_competitor_metrics.avg_engagement_estimate IS 'Estimated average engagement rate (percentage)';

