# Studio Scheduling & Publishing Implementation Summary

## Overview

Implemented a complete scheduling and publishing pipeline for Studio posts, enabling users to schedule posts for future publication or publish immediately to Instagram, TikTok, and Facebook.

## What Changed

### 1. Database Schema Updates

**Migration**: `supabase/migrations/20250123000000_studio_publishing_schema.sql`

Added the following fields to `studio_social_posts`:
- `status` (TEXT) - Post state: `draft`, `scheduled`, `publishing`, `posted`, `failed`
- `last_publish_attempt_at` (TIMESTAMPTZ) - Timestamp of last publish attempt
- `last_publish_error` (TEXT) - Error message from last failed attempt
- `published_at` (TIMESTAMPTZ) - Timestamp when post was successfully published
- `platform_post_id` (TEXT) - Platform-specific post ID after successful publish

**Indexes added**:
- `idx_studio_social_posts_scheduled` - For finding scheduled posts ready to publish
- `idx_studio_social_posts_publishing` - For monitoring posts in publishing state
- `idx_studio_social_posts_failed` - For finding failed posts (retry logic)
- `idx_studio_social_posts_platform_post_id` - For platform post ID lookups

**Triggers**:
- `trigger_update_published_at_on_post` - Automatically sets `published_at` when status changes to `posted`

**Data migration**:
- Existing posts are automatically assigned appropriate status based on their current state
- Posts with `posted_at` are marked as `posted`
- Posts with future `scheduled_for` are marked as `scheduled`
- Past scheduled posts without `posted_at` are marked as `failed`

### 2. Publishing Service

**File**: `lib/studio/publish-service.ts`

Created a centralized publishing service with platform-specific implementations:

- **`publishPost()`** - Main entry point that routes to platform-specific handlers
- **`publishToInstagram()`** - Two-step process:
  1. Create media container (photo or video/REELS)
  2. Publish the container
  - Handles video processing wait time
  - Returns permalink URL
- **`publishToTikTok()`** - Three-step process:
  1. Initialize upload
  2. Upload video chunks
  3. Publish
  - Only supports video posts
- **`publishToFacebook()`** - Direct POST to Graph API
  - Supports both photos and videos
  - Uses Page ID from social account metadata

**Features**:
- Error handling with retryable flag
- Platform-specific error messages
- Returns `platform_post_id` and `post_url` on success

### 3. Publish Job Handler

**File**: `app/api/studio/publish/[postId]/route.ts`

Handles individual post publishing with:
- **Idempotency**: Checks if post is already published before attempting
- **Status validation**: Ensures post is in valid state (`scheduled` or `failed`)
- **Time validation**: Verifies `scheduled_for` time has passed (with 1-minute buffer)
- **Status updates**: Updates post status to `publishing` before attempt
- **Retry logic**: 
  - Exponential backoff (5s, 10s, 20s)
  - Max 3 retry attempts
  - Only retries on transient errors (5xx, 429)
- **Error tracking**: Stores error messages in `last_publish_error`
- **Success handling**: Updates post with `platform_post_id`, `post_url`, `published_at`

### 4. Scheduler Cron Job

**File**: `app/api/cron/studio/publish/route.ts`

Periodic job that:
- Finds posts with `status = 'scheduled'` and `scheduled_for <= now`
- Finds posts stuck in `publishing` state (older than 10 minutes)
- Calls publish endpoint for each post
- Processes up to 50 scheduled posts and 20 stuck posts per run
- Returns summary of processed posts

**Configuration**: Added to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/studio/publish",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

Runs every minute to ensure timely publishing.

### 5. Post Creation/Scheduling API

**File**: `app/api/studio/posts/route.ts`

New endpoints for managing posts:

**POST `/api/studio/posts`**:
- Creates a new post (draft, scheduled, or immediate publish)
- Supports:
  - `platform` (instagram, tiktok, facebook)
  - `social_account_id` (required)
  - `asset_id` or `media_url` (required)
  - `caption` (optional)
  - `scheduled_for` (ISO timestamp, optional)
  - `publish_now` (boolean, optional)
- Automatically determines status based on `scheduled_for` and `publish_now`
- If `publish_now = true`, immediately publishes the post
- Returns created post with updated status

**GET `/api/studio/posts`**:
- Lists posts for the workspace
- Supports filtering by:
  - `platform` (query param)
  - `status` (query param)
  - `limit` (query param, default 50)
- Returns posts ordered by `created_at` (newest first)

## Files Touched

### New Files
1. `supabase/migrations/20250123000000_studio_publishing_schema.sql` - Database schema migration
2. `lib/studio/publish-service.ts` - Publishing service
3. `app/api/studio/publish/[postId]/route.ts` - Publish job handler
4. `app/api/cron/studio/publish/route.ts` - Scheduler cron job
5. `app/api/studio/posts/route.ts` - Post creation/scheduling API
6. `STUDIO_SCHEDULING_DISCOVERY.md` - Discovery document
7. `STUDIO_SCHEDULING_IMPLEMENTATION_SUMMARY.md` - This file

### Modified Files
1. `vercel.json` - Added cron job configuration

## Post State Machine

```
draft → scheduled → publishing → posted
                    ↓
                  failed → scheduled (retry) → publishing → posted
```

**States**:
- `draft`: Post created but not scheduled
- `scheduled`: Post scheduled for future publication
- `publishing`: Post is currently being published
- `posted`: Post successfully published
- `failed`: Post failed to publish (may be retried)

## Error Handling & Retries

### Retry Strategy
- **Max attempts**: 3
- **Backoff**: Exponential (5s, 10s, 20s)
- **Retryable errors**: 
  - HTTP 5xx (server errors)
  - HTTP 429 (rate limiting)
  - Network errors
- **Non-retryable errors**:
  - Invalid token
  - Missing account
  - Invalid media URL
  - Platform-specific validation errors

### Error Tracking
- `last_publish_error`: Stores error message from last attempt
- `last_publish_attempt_at`: Timestamp of last attempt
- `status`: Current state (failed posts can be retried)

## Idempotency

The system ensures posts are not published twice:
1. Checks `status = 'posted'` and `platform_post_id` exists before publishing
2. Uses `platform_post_id` to track published posts
3. If post is already published, returns success without re-publishing

## Follow-Up Tasks & Edge Cases

### Immediate Follow-Ups

1. **Media URL Handling**:
   - Currently supports `asset_id` (from `studio_assets`) or `media_url` (direct URL)
   - Need to ensure media URLs are accessible from server (not signed URLs that expire)
   - Consider storing media in Supabase Storage with public URLs

2. **TikTok Username in Post URL**:
   - TikTok post URL construction is incomplete (uses placeholder `@username`)
   - Need to fetch actual username from TikTok account metadata
   - Update `publishToTikTok()` to return correct permalink

3. **Video Processing**:
   - Instagram video processing wait time is hardcoded (30 attempts × 10s = 5 minutes max)
   - Consider making this configurable or using webhooks if available

4. **Rate Limiting**:
   - No rate limiting protection in place
   - Platform APIs may throttle requests
   - Consider adding rate limiting per workspace/platform

5. **Token Refresh**:
   - Publishing service doesn't refresh expired tokens
   - Should integrate with token refresh logic from `social-account-service.ts`
   - Add token expiry check before publishing

### UI Improvements Needed

1. **Post Creation UI**:
   - Create frontend form/component for scheduling posts
   - Show post status in UI (draft, scheduled, publishing, posted, failed)
   - Display error messages for failed posts
   - Allow manual retry for failed posts

2. **Scheduling Calendar**:
   - Visual calendar view of scheduled posts
   - Drag-and-drop rescheduling
   - Bulk operations (delete, reschedule)

3. **Post Status Dashboard**:
   - Real-time status updates
   - Filter by status/platform
   - Retry failed posts button

4. **Notifications**:
   - Notify users when posts are published
   - Alert on publish failures
   - Email/SMS notifications for critical failures

### Platform-Specific Considerations

1. **Instagram**:
   - Requires Instagram Business Account
   - Video posts require processing time
   - REELS support may need additional scopes
   - Carousel posts not yet supported

2. **TikTok**:
   - Only supports video posts
   - Requires Content Publishing API access
   - May have stricter content policies
   - Video format/size requirements

3. **Facebook**:
   - Requires Page access (not personal profile)
   - Video uploads may have size limits
   - Different API endpoints for photos vs videos

### Testing Requirements

1. **Unit Tests**:
   - Test publishing service for each platform
   - Test retry logic
   - Test idempotency checks

2. **Integration Tests**:
   - Test full publish flow (create → schedule → publish)
   - Test cron job execution
   - Test error handling and retries

3. **E2E Tests**:
   - Test scheduling a post
   - Test immediate publishing
   - Test failed post retry

### Security Considerations

1. **Cron Secret**:
   - Ensure `CRON_SECRET` is set in production
   - Validate secret in cron endpoint
   - Consider IP whitelisting for Vercel cron

2. **Media URL Validation**:
   - Validate media URLs before publishing
   - Ensure URLs are accessible
   - Consider content scanning for inappropriate content

3. **Token Security**:
   - Tokens are stored securely in `studio_social_accounts`
   - Only service role can access tokens
   - Consider encrypting tokens at rest

## Configuration

### Environment Variables

- `CRON_SECRET` or `VERCEL_CRON_SECRET` - Secret for cron job authentication
- `NEXT_PUBLIC_APP_URL` or `VERCEL_URL` - Base URL for internal API calls

### Vercel Cron

The cron job is configured in `vercel.json` to run every minute. In production, ensure:
1. Vercel cron is enabled for the project
2. `CRON_SECRET` is set in Vercel environment variables
3. Cron job has proper permissions

## Next Steps

1. **Test the implementation**:
   - Create test posts for each platform
   - Verify scheduling works correctly
   - Test retry logic with simulated failures

2. **Add token refresh**:
   - Integrate token refresh before publishing
   - Handle token expiry gracefully

3. **Improve error messages**:
   - Make error messages more user-friendly
   - Add error codes for different failure types

4. **Add monitoring**:
   - Log publish attempts and results
   - Track success/failure rates
   - Alert on high failure rates

5. **UI Development**:
   - Build post creation/scheduling UI
   - Add status dashboard
   - Implement retry functionality in UI

