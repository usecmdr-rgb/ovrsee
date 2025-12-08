-- ============================================================================
-- Migration: 20250121000000_social_connections_and_posts.sql
-- ============================================================================
-- Core user-level social media connection storage and post metrics
-- These tables are intentionally user-scoped (auth.users.id) and are meant
-- to complement the existing studio_* workspace-scoped social tables.
--
-- NOTE:
-- - Access tokens are stored here and should only be accessed via a
--   server-side Supabase client using the service role key.
-- - RLS is intentionally not enabled on social_connections so that only
--   the service role can access tokens.
-- ============================================================================

create table if not exists public.social_connections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,

  provider         text not null check (provider in ('facebook', 'instagram', 'tiktok')),
  provider_user_id text not null,

  access_token     text not null,
  refresh_token    text,
  expires_at       timestamptz,

  scopes           text[] default '{}',
  metadata         jsonb default '{}'::jsonb,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists social_connections_user_provider_idx
  on public.social_connections(user_id, provider);

-- ============================================================================
-- social_media_posts
-- ============================================================================

create table if not exists public.social_media_posts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  provider            text not null check (provider in ('facebook', 'instagram', 'tiktok')),
  provider_media_id   text not null,
  provider_account_id text not null,

  caption             text,
  media_url           text,
  media_type          text,

  metrics             jsonb not null default '{}'::jsonb,
  taken_at            timestamptz,
  fetched_at          timestamptz not null default now()
);

create index if not exists social_media_posts_user_provider_idx
  on public.social_media_posts(user_id, provider);

-- ============================================================================
-- TODO: In a future iteration, consider adding RLS policies that strictly
-- lock down access to these tables and rely on service-role-only access
-- for any operations involving access_token / refresh_token fields.
-- ============================================================================



