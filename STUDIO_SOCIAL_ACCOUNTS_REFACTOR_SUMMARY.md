# Studio Social Accounts Refactor Summary

## What Changed

### 1. Database Schema

**Migration:** `20250122000000_workspace_scoped_social_accounts.sql`

- **Added columns to `studio_social_accounts`:**
  - `access_token` TEXT - OAuth access token
  - `refresh_token` TEXT (nullable) - OAuth refresh token
  - `expires_at` TIMESTAMPTZ (nullable) - Token expiration
  - `scopes` TEXT[] - OAuth scopes granted
  - `connected_by` UUID - User who connected the account

- **Backfilled data:**
  - Migrated tokens from `social_connections` (user-scoped) to `studio_social_accounts` (workspace-scoped)
  - Linked existing `social_media_posts` to workspace accounts and created corresponding `studio_social_posts` entries
  - Migrated metrics to `studio_social_post_metrics`

- **Added unique constraint:**
  - `studio_social_posts(workspace_id, platform, external_post_id)` to prevent duplicates

### 2. Service Layer

**New file:** `lib/studio/social-account-service.ts`

- Central abstraction for workspace-scoped social accounts
- Functions:
  - `getSocialAccount()` - Get account metadata (tokens optional)
  - `getSocialAccountCredentials()` - Get tokens (service role only)
  - `getSocialAccounts()` - List all accounts for workspace
  - `upsertSocialAccount()` - Create/update account with tokens
  - `updateSocialAccountTokens()` - Refresh tokens
  - `updateSocialAccountLastSync()` - Update sync timestamp
  - `isTokenExpired()` - Check token expiry

### 3. OAuth Callbacks

**Updated files:**
- `app/api/oauth/facebook/callback/route.ts`
- `app/api/oauth/tiktok/callback/route.ts`

**Changes:**
- Now writes to both `social_connections` (backwards compatibility) and `studio_social_accounts` (new)
- Resolves workspace from user via `getWorkspaceIdForUser()`
- Uses `upsertSocialAccount()` service function
- Extracts handle/avatar from metadata based on platform

### 4. Refresh Endpoints

**Updated files:**
- `app/api/studio/social/instagram/refresh/route.ts`
- `app/api/studio/social/tiktok/refresh/route.ts`

**Changes:**
- Now reads tokens from `studio_social_accounts` (workspace-scoped) instead of `social_connections` (user-scoped)
- Writes posts to `studio_social_posts` instead of `social_media_posts`
- Writes metrics to `studio_social_post_metrics` with proper time-series structure
- Updates `last_sync_at` on account after sync

### 5. Other Endpoints

**Updated files:**
- `app/api/studio/social/status/route.ts` - Now reads from workspace-scoped accounts
- `app/api/studio/social/summary/route.ts` - Now reads from `studio_social_posts` instead of `social_media_posts`
- `app/api/studio/social/connect/route.ts` - Deprecated (returns error suggesting OAuth flow)
- `app/api/studio/ask/route.ts` - Updated to use workspace-scoped summary endpoint

### 6. Deprecation Comments

**Added deprecation notices:**
- `lib/social/summary.ts` - Marked as deprecated, points to workspace-scoped endpoint
- OAuth callbacks - TODO comments to remove `social_connections` writes after migration complete

## Files Touched

### New Files
- `supabase/migrations/20250122000000_workspace_scoped_social_accounts.sql`
- `lib/studio/social-account-service.ts`
- `STUDIO_SOCIAL_ACCOUNTS_REFACTOR_DESIGN.md`
- `STUDIO_SOCIAL_ACCOUNTS_REFACTOR_SUMMARY.md`

### Modified Files
- `app/api/oauth/facebook/callback/route.ts` - Now writes to workspace-scoped accounts
- `app/api/oauth/tiktok/callback/route.ts` - Now writes to workspace-scoped accounts
- `app/api/studio/social/instagram/refresh/route.ts` - Reads from workspace accounts, writes to workspace posts
- `app/api/studio/social/tiktok/refresh/route.ts` - Reads from workspace accounts, writes to workspace posts
- `app/api/studio/social/status/route.ts` - Reads from workspace-scoped accounts
- `app/api/studio/social/summary/route.ts` - Reads from workspace-scoped posts
- `app/api/studio/social/connect/route.ts` - Deprecated (returns error)
- `app/api/studio/ask/route.ts` - Uses workspace-scoped summary data
- `lib/social/summary.ts` - Added deprecation comment

## Follow-Up Tasks

### High Priority

1. **Test OAuth Flows**
   - Verify Facebook/Instagram OAuth creates workspace accounts correctly
   - Verify TikTok OAuth creates workspace accounts correctly
   - Test with users who have multiple workspaces (if supported)

2. **Test Refresh Endpoints**
   - Verify Instagram refresh reads from workspace accounts
   - Verify TikTok refresh reads from workspace accounts
   - Verify posts are written to `studio_social_posts` correctly
   - Verify metrics are written to `studio_social_post_metrics` correctly

3. **Verify Migration**
   - Run migration on staging/test database
   - Verify backfill correctly links existing data
   - Check for any orphaned posts or accounts

### Medium Priority

4. **Remove Legacy Code** (after verification)
   - Remove writes to `social_connections` from OAuth callbacks
   - Remove `generateSocialSummary()` function (or keep for non-Studio use cases)
   - Consider removing `social_media_posts` table if no longer needed

5. **Update Frontend**
   - Verify `/api/studio/social/accounts` endpoint still works (should be fine)
   - Update any frontend code that calls deprecated endpoints
   - Test social account connection UI

6. **Token Refresh Automation**
   - Implement background job to refresh tokens before expiry
   - Use `studio_social_accounts.expires_at` index for efficient queries

### Low Priority

7. **Documentation**
   - Update API documentation for workspace-scoped endpoints
   - Document migration process for existing users

8. **Monitoring**
   - Add logging for token refresh failures
   - Monitor for any workspace-scope issues

## Edge Cases Discovered

1. **Multiple Workspaces per User**
   - Current implementation assumes one workspace per user (owner relationship)
   - If multi-workspace support is added, OAuth callbacks need to determine which workspace to use
   - **Solution:** OAuth state could include `workspace_id`, or use user's primary workspace

2. **Instagram via Facebook**
   - Facebook OAuth can connect Instagram Business accounts
   - Migration handles this by checking `metadata.ig_business_id`
   - Refresh endpoint correctly identifies Instagram accounts

3. **Token Expiry Handling**
   - No automatic refresh yet (follow-up task)
   - Endpoints return `token_expired` error, user must reconnect
   - **Future:** Implement token refresh background job

4. **Post Deduplication**
   - Unique constraint on `(workspace_id, platform, external_post_id)` prevents duplicates
   - Migration uses `ON CONFLICT DO NOTHING` to handle existing posts

5. **Metrics Time-Series**
   - `studio_social_post_metrics` supports multiple captures per post
   - Refresh endpoints use `ON CONFLICT` with `ignoreDuplicates` to prevent duplicate metrics
   - **Future:** Implement proper time-series aggregation

## Backwards Compatibility

- OAuth callbacks still write to `social_connections` for backwards compatibility
- `social_media_posts` table still exists (not deleted)
- Old endpoints may still work but are deprecated
- Migration backfills existing data to new schema

## Security Notes

- Tokens in `studio_social_accounts` should only be accessed via service role client
- RLS policies prevent direct user access to token fields
- Consider encryption at rest for tokens (future enhancement)

## Testing Checklist

- [ ] OAuth flow creates workspace account
- [ ] Refresh endpoint reads from workspace account
- [ ] Posts written to `studio_social_posts`
- [ ] Metrics written to `studio_social_post_metrics`
- [ ] Status endpoint returns workspace accounts
- [ ] Summary endpoint aggregates workspace posts
- [ ] Migration backfills existing data correctly
- [ ] Token expiry detection works
- [ ] Multi-workspace scenarios (if applicable)

