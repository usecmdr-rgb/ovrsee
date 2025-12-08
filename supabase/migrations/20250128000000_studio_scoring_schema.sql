-- ============================================================================
-- Migration: 20250128000000_studio_scoring_schema.sql
-- ============================================================================
-- Add performance prediction and scoring fields to studio_social_posts
-- 
-- This migration adds:
-- 1. Scoring fields (label, numeric, explanation, updated_at)
-- 2. Index for filtering by score
-- ============================================================================

-- ============================================================================
-- 1. ADD SCORING FIELDS TO studio_social_posts
-- ============================================================================

ALTER TABLE public.studio_social_posts
  ADD COLUMN IF NOT EXISTS predicted_score_label TEXT
    CONSTRAINT studio_social_posts_score_label_chk
    CHECK (predicted_score_label IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS predicted_score_numeric FLOAT
    CONSTRAINT studio_social_posts_score_numeric_chk
    CHECK (predicted_score_numeric >= 0.0 AND predicted_score_numeric <= 1.0),
  ADD COLUMN IF NOT EXISTS predicted_score_explanation TEXT,
  ADD COLUMN IF NOT EXISTS predicted_score_updated_at TIMESTAMPTZ;

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

-- Index for filtering by score label
CREATE INDEX IF NOT EXISTS idx_studio_social_posts_score_label
  ON public.studio_social_posts (workspace_id, predicted_score_label)
  WHERE predicted_score_label IS NOT NULL;

-- Index for sorting by score
CREATE INDEX IF NOT EXISTS idx_studio_social_posts_score_numeric
  ON public.studio_social_posts (workspace_id, predicted_score_numeric DESC)
  WHERE predicted_score_numeric IS NOT NULL;

-- ============================================================================
-- 3. ADD COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.studio_social_posts.predicted_score_label IS 'Expected performance level: low, medium, or high';
COMMENT ON COLUMN public.studio_social_posts.predicted_score_numeric IS 'Numeric score from 0.0 (low) to 1.0 (high)';
COMMENT ON COLUMN public.studio_social_posts.predicted_score_explanation IS 'LLM-generated explanation of the score';
COMMENT ON COLUMN public.studio_social_posts.predicted_score_updated_at IS 'Timestamp when score was last computed';

