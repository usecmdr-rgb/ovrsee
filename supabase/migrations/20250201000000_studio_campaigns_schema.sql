-- ============================================================================
-- Migration: 20250201000000_studio_campaigns_schema.sql
-- ============================================================================
-- Add campaign planning: campaigns table and campaign_id on posts
-- 
-- This migration adds:
-- 1. studio_campaigns - Multi-week campaigns with objectives
-- 2. campaign_id on studio_social_posts
-- ============================================================================

-- ============================================================================
-- 1. CREATE studio_campaigns TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  objective TEXT, -- e.g., 'launch', 'awareness', 'promo', 'engagement', etc.
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT studio_campaigns_dates_chk CHECK (end_date >= start_date)
);

-- Index for workspace queries
CREATE INDEX IF NOT EXISTS idx_studio_campaigns_workspace_id
  ON public.studio_campaigns (workspace_id);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_studio_campaigns_dates
  ON public.studio_campaigns (workspace_id, start_date, end_date);

-- ============================================================================
-- 2. ADD campaign_id TO studio_social_posts
-- ============================================================================

ALTER TABLE public.studio_social_posts
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.studio_campaigns(id) ON DELETE SET NULL;

-- Index for campaign queries
CREATE INDEX IF NOT EXISTS idx_studio_social_posts_campaign_id
  ON public.studio_social_posts (campaign_id)
  WHERE campaign_id IS NOT NULL;

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.studio_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view their campaigns" ON public.studio_campaigns
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_campaigns.workspace_id
    )
  );

CREATE POLICY "Workspace members can insert their campaigns" ON public.studio_campaigns
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_campaigns.workspace_id
    )
  );

CREATE POLICY "Workspace members can update their campaigns" ON public.studio_campaigns
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_campaigns.workspace_id
    )
  );

CREATE POLICY "Workspace members can delete their campaigns" ON public.studio_campaigns
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_campaigns.workspace_id
    )
  );

-- ============================================================================
-- 4. ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE public.studio_campaigns IS 'Multi-week campaigns for strategic content planning';
COMMENT ON COLUMN public.studio_campaigns.objective IS 'Campaign objective: launch, awareness, promo, engagement, etc.';
COMMENT ON COLUMN public.studio_social_posts.campaign_id IS 'Links post to a campaign';

