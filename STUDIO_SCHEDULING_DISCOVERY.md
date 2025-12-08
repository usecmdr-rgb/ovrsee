# Studio Scheduling & Publishing - Discovery

## Current State

### Database Schema
- **`studio_social_posts`** table exists with:
  - `scheduled_for` (TIMESTAMPTZ) - already present
  - `posted_at` (TIMESTAMPTZ) - already present
  - `status` (TEXT) - **MISSING** (needs to be added)
  - `last_publish_attempt_at` (TIMESTAMPTZ) - **MISSING**
  - `last_publish_error` (TEXT) - **MISSING**
  - `published_at` (TIMESTAMPTZ) - **MISSING** (can use `posted_at` or add separate field)
  - `platform_post_id` (TEXT) - **MISSING** (currently stored as `external_post_id` for fetched posts, but not for published posts)
  - `error_message` (TEXT) - already present in migration

### Existing Infrastructure
- **Cron pattern**: `/api/cron/insight/run` exists as a template for scheduled jobs
- **Vercel cron**: Can be configured via `vercel.json` (currently not configured)
- **No job queue**: No BullMQ, Redis queue, or similar infrastructure
- **Social account service**: `lib/studio/social-account-service.ts` provides workspace-scoped account access

### Publishing Code
- **Instagram**: Only fetching/reading code exists (`lib/social/instagram.ts`)
  - `fetchInstagramMedia` - reads posts
  - `fetchMediaInsights` - reads metrics
  - **NO publishing code exists**
- **TikTok**: Only fetching/reading code exists (`lib/social/tiktok.ts`)
  - `fetchTikTokVideos` - reads posts
  - **NO publishing code exists**
- **Facebook**: No code exists at all

### API Endpoints
- `/api/studio/social/instagram/refresh` - fetches existing posts
- `/api/studio/social/tiktok/refresh` - fetches existing posts
- `/api/studio/analytics/posts` - reads posts
- **NO endpoint exists for creating/scheduling posts**

## What's Missing

1. **Post state machine**: No status tracking for draft → scheduled → publishing → posted/failed
2. **Scheduler**: No cron job that finds scheduled posts and enqueues them
3. **Publishing logic**: No code to actually publish to Instagram/TikTok/Facebook APIs
4. **Job queue**: No queue system (will use simple cron + direct execution for MVP)
5. **Retry logic**: No retry mechanism for failed publishes
6. **Idempotency**: No checks to prevent double-posting

## Platform API Requirements

### Instagram Graph API
- Requires: Photo Container API (upload photo → get container_id → publish)
- Endpoint: `POST /{ig-user-id}/media` (create container)
- Endpoint: `POST /{ig-container-id}/publish` (publish)
- Requires: `instagram_basic`, `instagram_content_publish`, `pages_show_list` scopes

### TikTok API
- Requires: TikTok Content Publishing API
- Endpoint: `POST /v2/post/publish/video/init/` (initialize upload)
- Endpoint: `POST /v2/post/publish/video/upload/` (upload video chunks)
- Endpoint: `POST /v2/post/publish/video/publish/` (publish)
- Requires: `video.upload`, `video.publish` scopes

### Facebook Graph API
- Similar to Instagram (uses same Graph API)
- Endpoint: `POST /{page-id}/photos` (for photos)
- Endpoint: `POST /{page-id}/videos` (for videos)
- Requires: `pages_manage_posts`, `pages_read_engagement` scopes

## Implementation Plan

1. **Database migration**: Add status fields to `studio_social_posts`
2. **Cron endpoint**: `/api/cron/studio/publish` - finds scheduled posts, enqueues them
3. **Publish service**: `lib/studio/publish-service.ts` - platform-specific publishing logic
4. **Job handler**: `/api/studio/publish/[postId]` - handles individual post publishing
5. **Retry logic**: Built into job handler with exponential backoff
6. **Idempotency**: Check `platform_post_id` before publishing

