-- ============================================================================
-- Migration: 20250124000000_studio_brand_profiles.sql
-- ============================================================================
-- Add brand_profiles table for workspace-scoped brand identity
-- 
-- This migration creates:
-- 1. brand_profiles table with workspace_id, brand_description, target_audience, voice_tone
-- 2. Unique constraint to ensure one brand profile per workspace
-- 3. RLS policies for workspace-scoped access
-- ============================================================================

-- ============================================================================
-- 1. CREATE brand_profiles TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Core brand identity
  brand_description TEXT,
  target_audience TEXT,
  
  -- Voice and tone (stored as JSON for flexibility)
  voice_tone JSONB DEFAULT '{}'::jsonb,
  -- Example structure:
  -- {
  --   "style": "professional" | "casual" | "friendly" | "authoritative" | "playful",
  --   "formality": "formal" | "semi-formal" | "casual",
  --   "personality": ["warm", "confident", "helpful"],
  --   "do_not_use": ["jargon", "slang", "technical terms"],
  --   "preferred_phrases": ["innovative", "cutting-edge"]
  -- }
  
  -- Additional brand attributes (flexible JSON for future extensions)
  brand_attributes JSONB DEFAULT '{}'::jsonb,
  -- Example structure:
  -- {
  --   "keywords": ["innovation", "quality", "sustainability"],
  --   "colors": ["#FF5733", "#33FF57"],
  --   "values": ["transparency", "excellence"],
  --   "mission": "To empower businesses...",
  --   "tagline": "Your tagline here"
  -- }
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 2. ADD UNIQUE CONSTRAINT
-- ============================================================================
-- Ensure one brand profile per workspace

CREATE UNIQUE INDEX IF NOT EXISTS brand_profiles_workspace_id_key
  ON public.brand_profiles (workspace_id);

-- ============================================================================
-- 3. ADD INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_brand_profiles_workspace_id
  ON public.brand_profiles (workspace_id);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_updated_at
  ON public.brand_profiles (updated_at);

-- ============================================================================
-- 4. ADD UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_brand_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_brand_profiles_updated_at ON public.brand_profiles;
CREATE TRIGGER trigger_update_brand_profiles_updated_at
  BEFORE UPDATE ON public.brand_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_brand_profiles_updated_at();

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Workspace members can view their workspace's brand profile
CREATE POLICY "Workspace members can view brand profile"
  ON public.brand_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = brand_profiles.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Policy: Workspace members can insert brand profile
CREATE POLICY "Workspace members can insert brand profile"
  ON public.brand_profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = brand_profiles.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Policy: Workspace members can update their workspace's brand profile
CREATE POLICY "Workspace members can update brand profile"
  ON public.brand_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = brand_profiles.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = brand_profiles.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE public.brand_profiles IS 'Brand identity profiles for workspaces, used to inform Studio AI content generation';
COMMENT ON COLUMN public.brand_profiles.brand_description IS 'High-level description of the brand, its mission, and core identity';
COMMENT ON COLUMN public.brand_profiles.target_audience IS 'Description of the target audience, demographics, and psychographics';
COMMENT ON COLUMN public.brand_profiles.voice_tone IS 'JSON object defining voice and tone preferences (style, formality, personality traits, etc.)';
COMMENT ON COLUMN public.brand_profiles.brand_attributes IS 'Flexible JSON object for additional brand attributes (keywords, colors, values, mission, tagline, etc.)';

