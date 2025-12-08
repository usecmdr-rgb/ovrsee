-- ============================================================================
-- Migration: 20250126000000_studio_hashtags_schema.sql
-- ============================================================================
-- Add hashtag tracking and analytics to Studio
-- 
-- This migration adds:
-- 1. studio_hashtags - Stores unique hashtags per workspace
-- 2. studio_post_hashtags - Links posts to hashtags (many-to-many)
-- 3. Indexes for efficient queries
-- ============================================================================

-- ============================================================================
-- 1. CREATE studio_hashtags TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Hashtag name (without #, lowercase)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique hashtag per workspace
  CONSTRAINT unique_hashtag_per_workspace UNIQUE (workspace_id, name)
);

-- Index for workspace queries
CREATE INDEX IF NOT EXISTS idx_studio_hashtags_workspace_id
  ON public.studio_hashtags (workspace_id);

-- Index for name lookups
CREATE INDEX IF NOT EXISTS idx_studio_hashtags_name
  ON public.studio_hashtags (name);

-- ============================================================================
-- 2. CREATE studio_post_hashtags TABLE (Junction Table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_post_hashtags (
  post_id UUID NOT NULL REFERENCES public.studio_social_posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES public.studio_hashtags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (post_id, hashtag_id)
);

-- Index for post queries
CREATE INDEX IF NOT EXISTS idx_studio_post_hashtags_post_id
  ON public.studio_post_hashtags (post_id);

-- Index for hashtag queries
CREATE INDEX IF NOT EXISTS idx_studio_post_hashtags_hashtag_id
  ON public.studio_post_hashtags (hashtag_id);

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.studio_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_post_hashtags ENABLE ROW LEVEL SECURITY;

-- Hashtags policies
CREATE POLICY "Workspace members can view their hashtags" ON public.studio_hashtags
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_hashtags.workspace_id
    )
  );

CREATE POLICY "Workspace members can insert their hashtags" ON public.studio_hashtags
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_hashtags.workspace_id
    )
  );

CREATE POLICY "Workspace members can update their hashtags" ON public.studio_hashtags
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_hashtags.workspace_id
    )
  );

-- Post-hashtags policies
CREATE POLICY "Workspace members can view their post hashtags" ON public.studio_post_hashtags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.studio_social_posts p
      WHERE p.id = public.studio_post_hashtags.post_id
        AND auth.uid() IN (
          SELECT user_id FROM public.workspace_members 
          WHERE workspace_id = p.workspace_id
        )
    )
  );

CREATE POLICY "Workspace members can insert their post hashtags" ON public.studio_post_hashtags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.studio_social_posts p
      WHERE p.id = public.studio_post_hashtags.post_id
        AND auth.uid() IN (
          SELECT user_id FROM public.workspace_members 
          WHERE workspace_id = p.workspace_id
        )
    )
  );

CREATE POLICY "Workspace members can delete their post hashtags" ON public.studio_post_hashtags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.studio_social_posts p
      WHERE p.id = public.studio_post_hashtags.post_id
        AND auth.uid() IN (
          SELECT user_id FROM public.workspace_members 
          WHERE workspace_id = p.workspace_id
        )
    )
  );

-- ============================================================================
-- 4. FUNCTION TO UPDATE last_used_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_hashtag_last_used()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.studio_hashtags
  SET last_used_at = NOW()
  WHERE id = NEW.hashtag_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_hashtag_last_used
  AFTER INSERT ON public.studio_post_hashtags
  FOR EACH ROW
  EXECUTE FUNCTION update_hashtag_last_used();

