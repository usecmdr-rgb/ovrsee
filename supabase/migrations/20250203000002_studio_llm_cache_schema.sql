-- ============================================================================
-- Migration: 20250203000002_studio_llm_cache_schema.sql
-- ============================================================================
-- Add LLM response caching for Studio
-- 
-- This migration adds:
-- 1. studio_llm_cache - Caches LLM responses to reduce API costs
-- ============================================================================

-- ============================================================================
-- 1. CREATE studio_llm_cache TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_llm_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE, -- SHA-256 hash of prompt + context
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  cache_type TEXT NOT NULL, -- 'experiment_summary', 'report_summary', 'scoring_explanation', 'competitor_insights'
  response_text TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cache key lookups
CREATE INDEX IF NOT EXISTS idx_studio_llm_cache_key
  ON public.studio_llm_cache (cache_key);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_studio_llm_cache_expires
  ON public.studio_llm_cache (expires_at);

-- Index for workspace queries
CREATE INDEX IF NOT EXISTS idx_studio_llm_cache_workspace
  ON public.studio_llm_cache (workspace_id)
  WHERE workspace_id IS NOT NULL;

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.studio_llm_cache ENABLE ROW LEVEL SECURITY;

-- Workspace members can view their cached responses
CREATE POLICY "Workspace members can view their cache" ON public.studio_llm_cache
  FOR SELECT USING (
    workspace_id IS NULL OR
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id = public.studio_llm_cache.workspace_id
    )
  );

-- Service role can insert/update cache (for background jobs)
CREATE POLICY "Service role can manage cache" ON public.studio_llm_cache
  FOR ALL USING (true);

-- ============================================================================
-- 3. ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE public.studio_llm_cache IS 'Caches LLM responses to reduce API costs';
COMMENT ON COLUMN public.studio_llm_cache.cache_key IS 'SHA-256 hash of prompt + context for cache lookup';
COMMENT ON COLUMN public.studio_llm_cache.cache_type IS 'Type of cached response: experiment_summary, report_summary, scoring_explanation, competitor_insights';
COMMENT ON COLUMN public.studio_llm_cache.expires_at IS 'When this cache entry expires';

