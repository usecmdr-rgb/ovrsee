-- ============================================================================
-- Migration: 20250203000001_studio_onboarding_schema.sql
-- ============================================================================
-- Add onboarding state tracking for Studio
-- 
-- This migration adds:
-- 1. studio_onboarding_state - Tracks onboarding progress per workspace
-- ============================================================================

-- ============================================================================
-- 1. CREATE studio_onboarding_state TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_onboarding_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  completed_steps JSONB DEFAULT '[]'::jsonb, -- Array of step IDs: ["connect_accounts", "brand_profile", "first_plan", "review"]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_workspace_onboarding UNIQUE (workspace_id)
);

-- Index for workspace queries
CREATE INDEX IF NOT EXISTS idx_studio_onboarding_state_workspace_id
  ON public.studio_onboarding_state (workspace_id);

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.studio_onboarding_state ENABLE ROW LEVEL SECURITY;

-- Workspace members can view their onboarding state
CREATE POLICY "Workspace members can view their onboarding state" ON public.studio_onboarding_state
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_onboarding_state.workspace_id
    )
  );

-- Workspace members can update their onboarding state
CREATE POLICY "Workspace members can update their onboarding state" ON public.studio_onboarding_state
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_onboarding_state.workspace_id
    )
  );

-- Workspace members can insert their onboarding state
CREATE POLICY "Workspace members can insert their onboarding state" ON public.studio_onboarding_state
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_onboarding_state.workspace_id
    )
  );

-- ============================================================================
-- 3. ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE public.studio_onboarding_state IS 'Tracks onboarding progress for Studio per workspace';
COMMENT ON COLUMN public.studio_onboarding_state.completed_steps IS 'Array of completed step IDs: connect_accounts, brand_profile, first_plan, review';

