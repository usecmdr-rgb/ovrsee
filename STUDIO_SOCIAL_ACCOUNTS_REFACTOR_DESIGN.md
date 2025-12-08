# Studio Social Accounts Refactor Design

## Current State Analysis

### Tables

1. **`social_connections`** (user-scoped)
   - Stores: `user_id`, `provider`, `provider_user_id`, `access_token`, `refresh_token`, `expires_at`, `scopes`, `metadata`
   - Unique: `(user_id, provider)`
   - Used by: OAuth callbacks, refresh endpoints

2. **`studio_social_accounts`** (workspace-scoped)
   - Stores: `workspace_id`, `platform`, `status`, `external_account_id`, `handle`, `avatar_url`, `connected_at`, `last_sync_at`, `metadata`
   - Unique: `(workspace_id, platform)`
   - **Missing:** No token storage

3. **`social_media_posts`** (user-scoped)
   - Stores: `user_id`, `provider`, `provider_media_id`, `provider_account_id`, `caption`, `media_url`, `metrics`, `taken_at`
   - Used by: Refresh endpoints to store fetched posts

4. **`studio_social_posts`** (workspace-scoped)
   - Stores: `workspace_id`, `social_account_id` (FK to `studio_social_accounts`), `platform`, `external_post_id`, `caption`, `posted_at`, `scheduled_for`
   - Used by: Analytics endpoints

### Current Relationships

- `social_connections` ← OAuth callbacks write here
- `studio_social_accounts` ← `/api/studio/social/connect` writes here (simulated)
- `social_media_posts` ← Refresh endpoints write here (user-scoped)
- `studio_social_posts` ← Not populated by refresh endpoints

### Token Read/Write Locations

**Write:**
- `app/api/oauth/facebook/callback/route.ts` - writes to `social_connections`
- `app/api/oauth/tiktok/callback/route.ts` - writes to `social_connections`

**Read:**
- `app/api/studio/social/instagram/refresh/route.ts` - reads from `social_connections` (user-scoped)
- `app/api/studio/social/tiktok/refresh/route.ts` - reads from `social_connections` (user-scoped)
- `app/api/studio/social/status/route.ts` - reads from `social_connections` (user-scoped)

## Target Schema Design

### 1. `studio_social_accounts` (Enhanced)

**Add columns:**
- `access_token` TEXT (encrypted or stored securely)
- `refresh_token` TEXT (nullable)
- `expires_at` TIMESTAMPTZ (nullable)
- `scopes` TEXT[] (default '{}')
- `connected_by` UUID REFERENCES auth.users(id) (who connected it)

**Keep existing:**
- `workspace_id`, `platform`, `status`, `external_account_id`, `handle`, `avatar_url`, `connected_at`, `last_sync_at`, `metadata`

**RLS:** Already has workspace-scoped policies

### 2. `studio_social_posts` (No changes needed)

Already has `social_account_id` FK. Just need to ensure refresh endpoints populate this table instead of `social_media_posts`.

### 3. Migration Strategy

**Phase 1: Add columns to `studio_social_accounts`**
- Add token columns (nullable initially)
- Backfill: For each `social_connection`, find user's workspace, create/update `studio_social_account` with tokens

**Phase 2: Update OAuth callbacks**
- After writing to `social_connections`, also write to `studio_social_accounts` for user's workspace
- Link the two via metadata or direct lookup

**Phase 3: Update refresh endpoints**
- Read tokens from `studio_social_accounts` instead of `social_connections`
- Write posts to `studio_social_posts` instead of `social_media_posts`

**Phase 4: Deprecate old usage**
- Mark `social_connections` as deprecated for Studio
- Keep `social_media_posts` for backwards compatibility but stop writing to it

### 4. Multi-Tenant Safety

- All `studio_social_accounts` queries must filter by `workspace_id`
- RLS policies already enforce workspace membership
- OAuth callbacks must resolve workspace from user (via `getWorkspaceIdForUser`)

### 5. Token Security

- Tokens stored in `studio_social_accounts` should only be accessible via service role client
- RLS policies prevent direct user access to token fields
- Consider encryption at rest (PostgreSQL encryption or application-level)

## Implementation Plan

1. **Migration:** Add token columns to `studio_social_accounts`, backfill from `social_connections`
2. **Service Layer:** Create `SocialAccountService` to abstract token access
3. **OAuth Callbacks:** Update to write to both tables (backwards compatible)
4. **Refresh Endpoints:** Migrate to use workspace-scoped accounts
5. **Deprecation:** Add TODOs for removing `social_connections` dependency

