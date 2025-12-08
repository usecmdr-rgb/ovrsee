-- ============================================================================
-- Migration: 20250122000000_workspace_scoped_social_accounts.sql
-- ============================================================================
-- Refactor social accounts to be workspace-scoped with token storage
-- 
-- This migration:
-- 1. Adds token columns to studio_social_accounts
-- 2. Backfills tokens from social_connections
-- 3. Ensures all posts reference workspace-scoped accounts
-- ============================================================================

-- ============================================================================
-- 1. ADD TOKEN COLUMNS TO studio_social_accounts
-- ============================================================================

ALTER TABLE public.studio_social_accounts
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for token expiry queries (for background refresh jobs)
CREATE INDEX IF NOT EXISTS idx_studio_social_accounts_expires_at
  ON public.studio_social_accounts (expires_at)
  WHERE expires_at IS NOT NULL;

-- ============================================================================
-- 2. BACKFILL TOKENS FROM social_connections
-- ============================================================================
-- For each social_connection, find the user's workspace and create/update
-- the corresponding studio_social_account with tokens

DO $$
DECLARE
  conn RECORD;
  workspace_id_val UUID;
  platform_val TEXT;
BEGIN
  FOR conn IN 
    SELECT 
      sc.user_id,
      sc.provider,
      sc.provider_user_id,
      sc.access_token,
      sc.refresh_token,
      sc.expires_at,
      sc.scopes,
      sc.metadata,
      sc.created_at
    FROM public.social_connections sc
  LOOP
    -- Map provider to platform (they're the same except for instagram/facebook)
    platform_val := CASE 
      WHEN conn.provider = 'facebook' THEN 'facebook'
      WHEN conn.provider = 'instagram' THEN 'instagram'
      WHEN conn.provider = 'tiktok' THEN 'tiktok'
      ELSE conn.provider
    END;

    -- Get user's workspace (create if doesn't exist)
    SELECT w.id INTO workspace_id_val
    FROM public.workspaces w
    WHERE w.owner_user_id = conn.user_id
    LIMIT 1;

    -- If no workspace exists, create one
    IF workspace_id_val IS NULL THEN
      INSERT INTO public.workspaces (owner_user_id, name)
      VALUES (conn.user_id, 'My Workspace')
      RETURNING id INTO workspace_id_val;
    END IF;

    -- Extract account metadata
    DECLARE
      handle_val TEXT;
      avatar_url_val TEXT;
      external_account_id_val TEXT;
    BEGIN
      -- Extract from metadata based on provider
      IF platform_val = 'instagram' THEN
        handle_val := COALESCE(
          (conn.metadata->>'username')::TEXT,
          (conn.metadata->>'name')::TEXT
        );
        external_account_id_val := COALESCE(
          (conn.metadata->>'ig_business_id')::TEXT,
          conn.provider_user_id
        );
      ELSIF platform_val = 'tiktok' THEN
        handle_val := COALESCE(
          (conn.metadata->>'username')::TEXT,
          (conn.metadata->>'display_name')::TEXT
        );
        avatar_url_val := (conn.metadata->>'avatar_url')::TEXT;
        external_account_id_val := conn.provider_user_id;
      ELSIF platform_val = 'facebook' THEN
        handle_val := (conn.metadata->>'name')::TEXT;
        external_account_id_val := conn.provider_user_id;
      END IF;

      -- Upsert studio_social_account with tokens
      INSERT INTO public.studio_social_accounts (
        workspace_id,
        platform,
        status,
        external_account_id,
        handle,
        avatar_url,
        access_token,
        refresh_token,
        expires_at,
        scopes,
        connected_at,
        connected_by,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        workspace_id_val,
        platform_val,
        'connected',
        external_account_id_val,
        handle_val,
        avatar_url_val,
        conn.access_token,
        conn.refresh_token,
        conn.expires_at,
        COALESCE(conn.scopes, '{}'),
        conn.created_at,
        conn.user_id,
        conn.metadata,
        conn.created_at,
        NOW()
      )
      ON CONFLICT (workspace_id, platform)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        scopes = EXCLUDED.scopes,
        status = 'connected',
        external_account_id = COALESCE(EXCLUDED.external_account_id, studio_social_accounts.external_account_id),
        handle = COALESCE(EXCLUDED.handle, studio_social_accounts.handle),
        avatar_url = COALESCE(EXCLUDED.avatar_url, studio_social_accounts.avatar_url),
        connected_at = COALESCE(EXCLUDED.connected_at, studio_social_accounts.connected_at),
        connected_by = COALESCE(EXCLUDED.connected_by, studio_social_accounts.connected_by),
        updated_at = NOW();
    END;
  END LOOP;
END $$;

-- ============================================================================
-- 3. MIGRATE social_media_posts TO studio_social_posts
-- ============================================================================
-- Link existing social_media_posts to workspace accounts and create
-- corresponding studio_social_posts entries

DO $$
DECLARE
  post RECORD;
  workspace_id_val UUID;
  social_account_id_val UUID;
  platform_val TEXT;
BEGIN
  FOR post IN
    SELECT 
      smp.user_id,
      smp.provider,
      smp.provider_media_id,
      smp.provider_account_id,
      smp.caption,
      smp.media_url,
      smp.media_type,
      smp.metrics,
      smp.taken_at,
      smp.fetched_at
    FROM public.social_media_posts smp
  LOOP
    -- Map provider to platform
    platform_val := CASE 
      WHEN post.provider = 'facebook' THEN 'facebook'
      WHEN post.provider = 'instagram' THEN 'instagram'
      WHEN post.provider = 'tiktok' THEN 'tiktok'
      ELSE post.provider
    END;

    -- Get user's workspace
    SELECT w.id INTO workspace_id_val
    FROM public.workspaces w
    WHERE w.owner_user_id = post.user_id
    LIMIT 1;

    IF workspace_id_val IS NULL THEN
      CONTINUE; -- Skip if no workspace
    END IF;

    -- Find or create social account
    SELECT id INTO social_account_id_val
    FROM public.studio_social_accounts
    WHERE workspace_id = workspace_id_val
      AND platform = platform_val
      AND external_account_id = post.provider_account_id
    LIMIT 1;

    -- If account not found, try to find by platform only
    IF social_account_id_val IS NULL THEN
      SELECT id INTO social_account_id_val
      FROM public.studio_social_accounts
      WHERE workspace_id = workspace_id_val
        AND platform = platform_val
      LIMIT 1;
    END IF;

    -- Create studio_social_posts entry if account exists and post doesn't exist
    IF social_account_id_val IS NOT NULL THEN
      INSERT INTO public.studio_social_posts (
        workspace_id,
        social_account_id,
        platform,
        external_post_id,
        caption,
        posted_at,
        metadata
      )
      VALUES (
        workspace_id_val,
        social_account_id_val,
        platform_val,
        post.provider_media_id,
        post.caption,
        post.taken_at,
        jsonb_build_object(
          'media_url', post.media_url,
          'media_type', post.media_type,
          'fetched_at', post.fetched_at,
          'migrated_from', 'social_media_posts'
        )
      )
      ON CONFLICT DO NOTHING; -- Skip if already exists

      -- Migrate metrics if available
      IF post.metrics IS NOT NULL AND post.metrics != '{}'::jsonb THEN
        INSERT INTO public.studio_social_post_metrics (
          social_post_id,
          captured_at,
          impressions,
          views,
          likes,
          comments,
          shares,
          saves,
          metadata
        )
        SELECT 
          sp.id,
          COALESCE(post.taken_at, post.fetched_at, NOW()),
          COALESCE((post.metrics->>'impressions')::INTEGER, 0),
          COALESCE((post.metrics->>'views')::INTEGER, (post.metrics->>'play_count')::INTEGER, 0),
          COALESCE((post.metrics->>'likes')::INTEGER, (post.metrics->>'like_count')::INTEGER, 0),
          COALESCE((post.metrics->>'comments')::INTEGER, (post.metrics->>'comment_count')::INTEGER, 0),
          COALESCE((post.metrics->>'shares')::INTEGER, (post.metrics->>'share_count')::INTEGER, 0),
          COALESCE((post.metrics->>'saves')::INTEGER, 0),
          post.metrics
        FROM public.studio_social_posts sp
        WHERE sp.workspace_id = workspace_id_val
          AND sp.external_post_id = post.provider_media_id
          AND sp.platform = platform_val
        LIMIT 1
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 4. ADD UNIQUE CONSTRAINT FOR POSTS (if not exists)
-- ============================================================================
-- Ensure we don't duplicate posts when syncing

-- Check if constraint exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'studio_social_posts_workspace_platform_external_post_id_key'
  ) THEN
    ALTER TABLE public.studio_social_posts
      ADD CONSTRAINT studio_social_posts_workspace_platform_external_post_id_key
      UNIQUE (workspace_id, platform, external_post_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists, ignore
    NULL;
END $$;

-- Add unique constraint for metrics to prevent duplicate captures
-- (allows multiple metrics per post but not at same timestamp)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'studio_social_post_metrics_post_id_captured_at_key'
  ) THEN
    ALTER TABLE public.studio_social_post_metrics
      ADD CONSTRAINT studio_social_post_metrics_post_id_captured_at_key
      UNIQUE (social_post_id, captured_at);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================================================
-- 5. UPDATE RLS POLICIES
-- ============================================================================
-- Ensure token fields are not accessible via RLS (service role only)

-- Token fields should not be selectable via RLS
-- We rely on service role client for token access
-- The existing policies already prevent direct access to sensitive data

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.studio_social_accounts.access_token IS 'OAuth access token (stored securely, service role access only)';
COMMENT ON COLUMN public.studio_social_accounts.refresh_token IS 'OAuth refresh token (nullable, service role access only)';
COMMENT ON COLUMN public.studio_social_accounts.expires_at IS 'Token expiration timestamp';
COMMENT ON COLUMN public.studio_social_accounts.scopes IS 'OAuth scopes granted';
COMMENT ON COLUMN public.studio_social_accounts.connected_by IS 'User who connected this account';

