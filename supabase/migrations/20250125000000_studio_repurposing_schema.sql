-- ============================================================================
-- Migration: 20250125000000_studio_repurposing_schema.sql
-- ============================================================================
-- Add repurposing support to studio_social_posts
-- 
-- This migration adds:
-- 1. repurposed_from_post_id - Links repurposed posts to their source
-- 2. content_group_id - Groups related posts (source + repurposed variants)
-- 3. Indexes for efficient queries
-- ============================================================================

-- ============================================================================
-- 1. ADD REPURPOSING FIELDS
-- ============================================================================

ALTER TABLE public.studio_social_posts
  ADD COLUMN IF NOT EXISTS repurposed_from_post_id UUID REFERENCES public.studio_social_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_group_id UUID;

-- Add comment for repurposing fields
COMMENT ON COLUMN public.studio_social_posts.repurposed_from_post_id IS 'ID of the source post this was repurposed from (for tracking ancestry)';
COMMENT ON COLUMN public.studio_social_posts.content_group_id IS 'UUID to group related posts (source + all repurposed variants)';

-- ============================================================================
-- 2. ADD INDEXES
-- ============================================================================

-- Index for finding repurposed posts from a source
CREATE INDEX IF NOT EXISTS idx_studio_social_posts_repurposed_from
  ON public.studio_social_posts (repurposed_from_post_id)
  WHERE repurposed_from_post_id IS NOT NULL;

-- Index for finding all posts in a content group
CREATE INDEX IF NOT EXISTS idx_studio_social_posts_content_group
  ON public.studio_social_posts (content_group_id)
  WHERE content_group_id IS NOT NULL;

-- ============================================================================
-- 3. FUNCTION TO SET CONTENT GROUP ID
-- ============================================================================
-- Helper function to ensure content_group_id is set when repurposing

CREATE OR REPLACE FUNCTION set_content_group_id_on_repurpose()
RETURNS TRIGGER AS $$
BEGIN
  -- If repurposed_from_post_id is set, inherit or create content_group_id
  IF NEW.repurposed_from_post_id IS NOT NULL THEN
    -- Get content_group_id from source post, or use source post's ID
    SELECT COALESCE(content_group_id, id) INTO NEW.content_group_id
    FROM public.studio_social_posts
    WHERE id = NEW.repurposed_from_post_id;
    
    -- If source post doesn't have content_group_id, set it to source post's ID
    IF NEW.content_group_id IS NULL THEN
      NEW.content_group_id := NEW.repurposed_from_post_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_content_group_id_on_repurpose ON public.studio_social_posts;
CREATE TRIGGER trigger_set_content_group_id_on_repurpose
  BEFORE INSERT OR UPDATE ON public.studio_social_posts
  FOR EACH ROW
  WHEN (NEW.repurposed_from_post_id IS NOT NULL)
  EXECUTE FUNCTION set_content_group_id_on_repurpose();

