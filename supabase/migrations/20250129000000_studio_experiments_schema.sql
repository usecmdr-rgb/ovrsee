-- ============================================================================
-- Migration: 20250129000000_studio_experiments_schema.sql
-- ============================================================================
-- Add A/B testing framework: experiments table and variant tagging on posts
-- 
-- This migration adds:
-- 1. studio_experiments - Groups posts that test the same hypothesis
-- 2. experiment_id and experiment_variant_label on studio_social_posts
-- 3. Indexes and RLS policies
-- ============================================================================

-- ============================================================================
-- 1. CREATE studio_experiments TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL
    CONSTRAINT studio_experiments_type_chk
    CHECK (type IN ('caption', 'hook', 'time', 'hashtags', 'media', 'other')),
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT studio_experiments_status_chk
    CHECK (status IN ('pending', 'running', 'completed', 'cancelled')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  winner_variant_label TEXT, -- 'A', 'B', 'C', etc.
  summary_markdown TEXT -- LLM-generated summary (optional, can be computed on-demand)
);

-- Index for workspace queries
CREATE INDEX IF NOT EXISTS idx_studio_experiments_workspace_id
  ON public.studio_experiments (workspace_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_studio_experiments_status
  ON public.studio_experiments (workspace_id, status);

-- ============================================================================
-- 2. ADD EXPERIMENT FIELDS TO studio_social_posts
-- ============================================================================

ALTER TABLE public.studio_social_posts
  ADD COLUMN IF NOT EXISTS experiment_id UUID REFERENCES public.studio_experiments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS experiment_variant_label TEXT
    CONSTRAINT studio_social_posts_variant_label_chk
    CHECK (experiment_variant_label IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'));

-- Index for experiment queries
CREATE INDEX IF NOT EXISTS idx_studio_social_posts_experiment_id
  ON public.studio_social_posts (experiment_id)
  WHERE experiment_id IS NOT NULL;

-- Composite index for variant lookups
CREATE INDEX IF NOT EXISTS idx_studio_social_posts_experiment_variant
  ON public.studio_social_posts (experiment_id, experiment_variant_label)
  WHERE experiment_id IS NOT NULL;

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.studio_experiments ENABLE ROW LEVEL SECURITY;

-- Experiments policies (workspace-scoped)
CREATE POLICY "Workspace members can view their experiments" ON public.studio_experiments
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_experiments.workspace_id
    )
  );

CREATE POLICY "Workspace members can insert their experiments" ON public.studio_experiments
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_experiments.workspace_id
    )
  );

CREATE POLICY "Workspace members can update their experiments" ON public.studio_experiments
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_experiments.workspace_id
    )
  );

-- ============================================================================
-- 4. ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE public.studio_experiments IS 'A/B tests grouping posts that test the same hypothesis';
COMMENT ON COLUMN public.studio_experiments.type IS 'Type of experiment: caption, hook, time, hashtags, media, other';
COMMENT ON COLUMN public.studio_experiments.status IS 'Lifecycle: pending → running → completed';
COMMENT ON COLUMN public.studio_experiments.winner_variant_label IS 'Variant that performed best (A, B, C, etc.)';
COMMENT ON COLUMN public.studio_experiments.summary_markdown IS 'LLM-generated summary of experiment results';
COMMENT ON COLUMN public.studio_social_posts.experiment_id IS 'Links post to an A/B test experiment';
COMMENT ON COLUMN public.studio_social_posts.experiment_variant_label IS 'Variant label (A, B, C, etc.) for this post in the experiment';

