-- ============================================================================
-- Migration: 20250123000000_studio_publishing_schema.sql
-- ============================================================================
-- Add publishing state machine fields to studio_social_posts
-- 
-- This migration adds:
-- 1. status field (draft, scheduled, publishing, posted, failed)
-- 2. Publishing tracking fields (last_publish_attempt_at, last_publish_error, published_at)
-- 3. platform_post_id for tracking published post IDs
-- 4. Indexes for efficient scheduler queries
-- ============================================================================

-- ============================================================================
-- 1. ADD STATUS AND PUBLISHING FIELDS
-- ============================================================================

ALTER TABLE public.studio_social_posts
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'
    CONSTRAINT studio_social_posts_status_chk
    CHECK (status IN ('draft', 'scheduled', 'publishing', 'posted', 'failed')),
  
  ADD COLUMN IF NOT EXISTS last_publish_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_publish_error TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  
  -- platform_post_id already exists as external_post_id, but we'll use it for published posts
  -- If external_post_id is null, we can use it for platform_post_id
  -- Otherwise, we'll add a separate field for clarity
  ADD COLUMN IF NOT EXISTS platform_post_id TEXT,
  
  -- created_by for tracking who created the post
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add comment for status field
COMMENT ON COLUMN public.studio_social_posts.status IS 'Post status: draft (not scheduled), scheduled (queued for publishing), publishing (in progress), posted (successfully published), failed (publish failed)';
COMMENT ON COLUMN public.studio_social_posts.last_publish_attempt_at IS 'Timestamp of last publish attempt (for retry logic)';
COMMENT ON COLUMN public.studio_social_posts.last_publish_error IS 'Error message from last failed publish attempt';
COMMENT ON COLUMN public.studio_social_posts.published_at IS 'Timestamp when post was successfully published';
COMMENT ON COLUMN public.studio_social_posts.platform_post_id IS 'Platform-specific post ID after successful publish (e.g., Instagram media ID)';

-- ============================================================================
-- 2. ADD INDEXES FOR SCHEDULER QUERIES
-- ============================================================================

-- Index for finding scheduled posts ready to publish
CREATE INDEX IF NOT EXISTS idx_studio_social_posts_scheduled
  ON public.studio_social_posts (status, scheduled_for)
  WHERE status = 'scheduled' AND scheduled_for IS NOT NULL;

-- Index for finding posts in publishing state (for monitoring/retry)
CREATE INDEX IF NOT EXISTS idx_studio_social_posts_publishing
  ON public.studio_social_posts (status, last_publish_attempt_at)
  WHERE status = 'publishing';

-- Index for finding failed posts (for retry logic)
CREATE INDEX IF NOT EXISTS idx_studio_social_posts_failed
  ON public.studio_social_posts (status, last_publish_attempt_at)
  WHERE status = 'failed';

-- Index for platform_post_id lookups
CREATE INDEX IF NOT EXISTS idx_studio_social_posts_platform_post_id
  ON public.studio_social_posts (platform_post_id)
  WHERE platform_post_id IS NOT NULL;

-- ============================================================================
-- 3. UPDATE EXISTING POSTS
-- ============================================================================
-- Set status for existing posts based on their current state

UPDATE public.studio_social_posts
SET status = CASE
  WHEN posted_at IS NOT NULL THEN 'posted'
  WHEN scheduled_for IS NOT NULL AND scheduled_for > NOW() THEN 'scheduled'
  WHEN scheduled_for IS NOT NULL AND scheduled_for <= NOW() THEN 'failed' -- Past scheduled posts without posted_at are considered failed
  ELSE 'draft'
END,
platform_post_id = external_post_id
WHERE status IS NULL OR status = 'draft';

-- Set published_at for posts that are already posted
UPDATE public.studio_social_posts
SET published_at = posted_at
WHERE posted_at IS NOT NULL AND published_at IS NULL;

-- ============================================================================
-- 4. ADD TRIGGER FOR STATUS UPDATES
-- ============================================================================
-- Automatically update published_at when status changes to 'posted'

CREATE OR REPLACE FUNCTION update_published_at_on_post()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'posted' AND OLD.status != 'posted' THEN
    NEW.published_at = COALESCE(NEW.published_at, NOW());
    NEW.posted_at = COALESCE(NEW.posted_at, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_published_at_on_post ON public.studio_social_posts;
CREATE TRIGGER trigger_update_published_at_on_post
  BEFORE UPDATE ON public.studio_social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_published_at_on_post();

