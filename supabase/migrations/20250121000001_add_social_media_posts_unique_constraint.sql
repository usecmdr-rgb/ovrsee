-- ============================================================================
-- Migration: 20250121000001_add_social_media_posts_unique_constraint.sql
-- ============================================================================
-- Add unique constraint to social_media_posts to prevent duplicate posts
-- This ensures each (user_id, provider, provider_media_id) combination is unique
-- ============================================================================

-- Create unique index (which enforces uniqueness)
create unique index if not exists social_media_posts_user_provider_media_unique_idx
  on public.social_media_posts(user_id, provider, provider_media_id);

-- Add comment for documentation
comment on index social_media_posts_user_provider_media_unique_idx is 
  'Ensures each social media post is stored only once per user/provider combination';


