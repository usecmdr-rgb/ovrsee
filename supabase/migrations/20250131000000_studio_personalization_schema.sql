-- ============================================================================
-- Migration: 20250131000000_studio_personalization_schema.sql
-- ============================================================================
-- Add personalization feedback events to track user behavior
-- 
-- This migration adds:
-- 1. studio_ai_feedback_events - Tracks how users interact with AI-generated content
-- ============================================================================

-- ============================================================================
-- 1. CREATE studio_ai_feedback_events TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_ai_feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.studio_social_posts(id) ON DELETE CASCADE,
  source TEXT NOT NULL
    CONSTRAINT studio_ai_feedback_events_source_chk
    CHECK (source IN ('planner', 'agent', 'repurpose', 'manual', 'unknown')),
  event_type TEXT NOT NULL
    CONSTRAINT studio_ai_feedback_events_type_chk
    CHECK (event_type IN ('accepted', 'deleted', 'heavily_edited', 'lightly_edited')),
  details JSONB DEFAULT '{}'::jsonb, -- Additional context (edit_distance, length_change, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for workspace queries
CREATE INDEX IF NOT EXISTS idx_studio_ai_feedback_events_workspace_id
  ON public.studio_ai_feedback_events (workspace_id);

-- Index for post lookups
CREATE INDEX IF NOT EXISTS idx_studio_ai_feedback_events_post_id
  ON public.studio_ai_feedback_events (post_id);

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_studio_ai_feedback_events_type
  ON public.studio_ai_feedback_events (workspace_id, event_type);

-- Composite index for preference analysis
CREATE INDEX IF NOT EXISTS idx_studio_ai_feedback_events_workspace_source
  ON public.studio_ai_feedback_events (workspace_id, source, event_type);

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.studio_ai_feedback_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view their feedback events" ON public.studio_ai_feedback_events
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_ai_feedback_events.workspace_id
    )
  );

CREATE POLICY "Workspace members can insert their feedback events" ON public.studio_ai_feedback_events
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_ai_feedback_events.workspace_id
    )
  );

-- ============================================================================
-- 3. ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE public.studio_ai_feedback_events IS 'Tracks user interactions with AI-generated content for personalization';
COMMENT ON COLUMN public.studio_ai_feedback_events.source IS 'Where the post originated from (planner, agent, repurpose, etc.)';
COMMENT ON COLUMN public.studio_ai_feedback_events.event_type IS 'What happened: accepted, deleted, heavily_edited, lightly_edited';
COMMENT ON COLUMN public.studio_ai_feedback_events.details IS 'Additional context: edit_distance, length_change, hashtag_change, etc.';

