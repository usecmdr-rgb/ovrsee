-- ============================================================================
-- Migration: 20250116021000_studio_social_and_analytics.sql
-- ============================================================================
-- Studio: social accounts, posts, metrics, and edit events
-- Extends studio schema with social media integration and analytics

-- ============================================================================
-- 1. CREATE studio_assets table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Asset metadata
  asset_type TEXT NOT NULL DEFAULT 'media'
    CONSTRAINT studio_assets_type_chk
    CHECK (asset_type IN ('media', 'template', 'overlay', 'filter', 'other')),
  
  name TEXT,
  filename TEXT,
  mime_type TEXT,
  
  -- Storage
  storage_path TEXT, -- Path in Supabase storage
  url TEXT, -- Public URL
  preview_url TEXT,
  
  -- Media dimensions (for images/videos)
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER, -- For videos
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_assets_workspace_id
  ON public.studio_assets (workspace_id);

CREATE INDEX IF NOT EXISTS idx_studio_assets_created_by
  ON public.studio_assets (created_by);

CREATE INDEX IF NOT EXISTS idx_studio_assets_asset_type
  ON public.studio_assets (asset_type);

CREATE INDEX IF NOT EXISTS idx_studio_assets_created_at
  ON public.studio_assets (created_at DESC);

-- ============================================================================
-- 2. CREATE studio_asset_versions table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_asset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  asset_id UUID NOT NULL REFERENCES public.studio_assets(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Version info
  version_number INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN DEFAULT TRUE,
  
  -- Storage
  storage_path TEXT,
  url TEXT,
  preview_url TEXT,
  
  -- Edit metadata
  edit_operations JSONB DEFAULT '[]'::jsonb, -- Array of edit operations applied
  caption TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_asset_versions_asset_id
  ON public.studio_asset_versions (asset_id);

CREATE INDEX IF NOT EXISTS idx_studio_asset_versions_is_current
  ON public.studio_asset_versions (is_current) WHERE is_current = TRUE;

-- ============================================================================
-- 3. CREATE studio_social_accounts table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  platform TEXT NOT NULL
    CONSTRAINT studio_social_accounts_platform_chk
    CHECK (platform IN ('instagram', 'tiktok', 'facebook')),

  status TEXT NOT NULL DEFAULT 'disconnected'
    CONSTRAINT studio_social_accounts_status_chk
    CHECK (status IN ('disconnected', 'connected', 'error')),

  external_account_id TEXT,     -- e.g. IG business account id
  handle TEXT,                  -- @handle or page name
  avatar_url TEXT,

  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (workspace_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_studio_social_accounts_workspace_id
  ON public.studio_social_accounts (workspace_id);

-- ============================================================================
-- 4. CREATE studio_social_posts table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  social_account_id UUID REFERENCES public.studio_social_accounts(id) ON DELETE SET NULL,

  asset_id UUID REFERENCES public.studio_assets(id) ON DELETE SET NULL, -- link back to uploaded media / caption

  platform TEXT NOT NULL
    CONSTRAINT studio_social_posts_platform_chk
    CHECK (platform IN ('instagram', 'tiktok', 'facebook')),

  external_post_id TEXT,     -- platform's post id
  post_url TEXT,
  caption TEXT,

  posted_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_studio_social_posts_workspace_id
  ON public.studio_social_posts (workspace_id);

CREATE INDEX IF NOT EXISTS idx_studio_social_posts_posted_at
  ON public.studio_social_posts (posted_at);

CREATE INDEX IF NOT EXISTS idx_studio_social_posts_social_account_id
  ON public.studio_social_posts (social_account_id);

-- ============================================================================
-- 5. CREATE studio_social_post_metrics table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_social_post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  social_post_id UUID NOT NULL REFERENCES public.studio_social_posts(id) ON DELETE CASCADE,

  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  impressions INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_studio_social_post_metrics_post_id
  ON public.studio_social_post_metrics (social_post_id);

CREATE INDEX IF NOT EXISTS idx_studio_social_post_metrics_captured_at
  ON public.studio_social_post_metrics (captured_at);

-- ============================================================================
-- 6. CREATE studio_edit_events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_edit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.studio_assets(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL
    CONSTRAINT studio_edit_events_type_chk
    CHECK (event_type IN ('create', 'edit', 'filter', 'crop', 'overlay', 'caption_edit')),

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_edit_events_workspace_id
  ON public.studio_edit_events (workspace_id);

CREATE INDEX IF NOT EXISTS idx_studio_edit_events_created_at
  ON public.studio_edit_events (created_at);

CREATE INDEX IF NOT EXISTS idx_studio_edit_events_asset_id
  ON public.studio_edit_events (asset_id);

-- ============================================================================
-- 7. CREATE updated_at trigger function (reuse shared)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. CREATE triggers for updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS set_timestamp_studio_assets ON public.studio_assets;
CREATE TRIGGER set_timestamp_studio_assets
  BEFORE UPDATE ON public.studio_assets
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS set_timestamp_studio_social_accounts ON public.studio_social_accounts;
CREATE TRIGGER set_timestamp_studio_social_accounts
  BEFORE UPDATE ON public.studio_social_accounts
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.studio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_asset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_social_post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_edit_events ENABLE ROW LEVEL SECURITY;

-- Studio assets policies
DROP POLICY IF EXISTS "workspace_members_can_view_studio_assets" ON public.studio_assets;
CREATE POLICY "workspace_members_can_view_studio_assets"
  ON public.studio_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = studio_assets.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "workspace_members_can_modify_studio_assets" ON public.studio_assets;
CREATE POLICY "workspace_members_can_modify_studio_assets"
  ON public.studio_assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = studio_assets.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

-- Studio asset versions policies
DROP POLICY IF EXISTS "workspace_members_can_view_studio_asset_versions" ON public.studio_asset_versions;
CREATE POLICY "workspace_members_can_view_studio_asset_versions"
  ON public.studio_asset_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.studio_assets sa
      JOIN public.workspaces w ON w.id = sa.workspace_id
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE sa.id = studio_asset_versions.asset_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "workspace_members_can_modify_studio_asset_versions" ON public.studio_asset_versions;
CREATE POLICY "workspace_members_can_modify_studio_asset_versions"
  ON public.studio_asset_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.studio_assets sa
      JOIN public.workspaces w ON w.id = sa.workspace_id
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE sa.id = studio_asset_versions.asset_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

-- Studio social accounts policies
DROP POLICY IF EXISTS "workspace_members_can_view_studio_social_accounts" ON public.studio_social_accounts;
CREATE POLICY "workspace_members_can_view_studio_social_accounts"
  ON public.studio_social_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = studio_social_accounts.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "workspace_owners_can_modify_studio_social_accounts" ON public.studio_social_accounts;
CREATE POLICY "workspace_owners_can_modify_studio_social_accounts"
  ON public.studio_social_accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = studio_social_accounts.workspace_id
        AND w.owner_user_id = auth.uid()
    )
  );

-- Studio social posts policies
DROP POLICY IF EXISTS "workspace_members_can_view_studio_social_posts" ON public.studio_social_posts;
CREATE POLICY "workspace_members_can_view_studio_social_posts"
  ON public.studio_social_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = studio_social_posts.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "workspace_members_can_modify_studio_social_posts" ON public.studio_social_posts;
CREATE POLICY "workspace_members_can_modify_studio_social_posts"
  ON public.studio_social_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = studio_social_posts.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

-- Studio social post metrics policies (inherit from posts)
DROP POLICY IF EXISTS "workspace_members_can_view_studio_social_post_metrics" ON public.studio_social_post_metrics;
CREATE POLICY "workspace_members_can_view_studio_social_post_metrics"
  ON public.studio_social_post_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.studio_social_posts sp
      JOIN public.workspaces w ON w.id = sp.workspace_id
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE sp.id = studio_social_post_metrics.social_post_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

-- Studio edit events policies
DROP POLICY IF EXISTS "workspace_members_can_view_studio_edit_events" ON public.studio_edit_events;
CREATE POLICY "workspace_members_can_view_studio_edit_events"
  ON public.studio_edit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = studio_edit_events.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "workspace_members_can_insert_studio_edit_events" ON public.studio_edit_events;
CREATE POLICY "workspace_members_can_insert_studio_edit_events"
  ON public.studio_edit_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = studio_edit_events.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.studio_assets IS 'Media assets uploaded to Studio (images, videos, templates, etc.)';
COMMENT ON TABLE public.studio_asset_versions IS 'Version history for studio assets (tracks edits and variations)';
COMMENT ON TABLE public.studio_social_accounts IS 'Connected social media accounts (Instagram, TikTok, Facebook)';
COMMENT ON TABLE public.studio_social_posts IS 'Posts published to social media from Studio';
COMMENT ON TABLE public.studio_social_post_metrics IS 'Metrics captured for social media posts (views, likes, comments, etc.)';
COMMENT ON TABLE public.studio_edit_events IS 'Tracks edit events for analytics (create, edit, filter, crop, etc.)';




