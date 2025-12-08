# Studio Social APIs Discovery

## Overview
This document catalogs the current implementation of social media integrations (Instagram, TikTok, Facebook) in Studio, identifying patterns, problems, and opportunities for abstraction.

---

## 1. OAuth Callbacks & Scopes

### Instagram (via Facebook)
- **Route**: `app/api/oauth/facebook/callback/route.ts`
- **Start Route**: `app/api/oauth/facebook/start/route.ts`
- **Scopes Requested**:
  - `public_profile`
  - `email`
  - `pages_show_list`
  - `instagram_basic`
  - `instagram_manage_insights`
- **Token Storage**: `studio_social_accounts` table (workspace-scoped)
- **Token Expiry**: Calculated from `expires_in` seconds, stored in `expires_at`
- **Notes**:
  - Instagram uses Facebook OAuth flow
  - Detects IG Business Account via `instagram_business_account` field
  - Exchanges short-lived token for long-lived token
  - Stores IG Business ID in `external_account_id` and `metadata.ig_business_id`

### TikTok
- **Route**: `app/api/oauth/tiktok/callback/route.ts`
- **Start Route**: `app/api/oauth/tiktok/start/route.ts`
- **Scopes Requested**:
  - `user.info.basic`
  - `video.list`
  - `video.upload`
- **Token Storage**: `studio_social_accounts` table (workspace-scoped)
- **Token Expiry**: Calculated from `expires_in` seconds, stored in `expires_at`
- **Notes**:
  - Uses PKCE flow (`code_verifier` in state)
  - Stores `open_id` in `external_account_id`
  - Stores username/display_name in `handle`

### Facebook
- **Route**: Same as Instagram (`app/api/oauth/facebook/callback/route.ts`)
- **Scopes**: Same as Instagram
- **Notes**:
  - Uses Facebook Graph API
  - Stores Page ID in `external_account_id` when no IG Business Account found
  - Platform determined by presence of `instagram_business_account`

---

## 2. Publishing Logic

### Current Implementation
- **File**: `lib/studio/publish-service.ts`
- **Main Function**: `publishPost(data: PublishPostData)`
- **Platform-Specific Functions**:
  - `publishToInstagram()` - Two-step: create container → publish
  - `publishToTikTok()` - Three-step: init → upload → publish
  - `publishToFacebook()` - Direct POST to Graph API

### Instagram Publishing Flow
1. **Create Media Container** (`POST /{ig_business_id}/media`)
   - Image: `image_url` param
   - Video: `media_type=REELS`, `video_url` param
   - Returns `container_id`
2. **Poll for Video Processing** (videos only)
   - Poll `/{container_id}?fields=status_code` until `FINISHED`
   - Max 30 attempts, 10s delay
3. **Publish Container** (`POST /{ig_business_id}/media_publish`)
   - Uses `creation_id=container_id`
   - Returns `platform_post_id`
4. **Fetch Permalink** (`GET /{platform_post_id}?fields=permalink`)

### TikTok Publishing Flow
1. **Initialize Upload** (`POST /v2/post/publish/video/init/`)
   - Returns `upload_url` and `publish_id`
2. **Upload Video** (`PUT` to `upload_url`)
   - Fetches video from `mediaUrl`, uploads as blob
3. **Publish** (`POST /v2/post/publish/video/publish/`)
   - Uses `publish_id`
   - Returns `video_id`

### Facebook Publishing Flow
1. **Direct POST** to `/{page_id}/photos` or `/{page_id}/videos`
   - Image: `url` param
   - Video: `file_url` param
   - Returns `id` or `post_id`

### Problems Identified
- Hardcoded API base URLs (`FB_GRAPH_BASE`, `TIKTOK_API_BASE`)
- Inconsistent error handling (some throw, some return `PublishResult`)
- Logging scattered (some use `logPlatformAPICall`, some don't)
- No centralized token refresh logic
- Rate limit handling is ad-hoc

---

## 3. Metrics Fetching

### Current Implementation
- **File**: `lib/studio/metrics-refresh-service.ts`
- **Helper Files**:
  - `lib/social/instagram.ts` - `fetchMediaInsights()`
  - `lib/social/tiktok.ts` - `fetchVideoMetrics()`

### Instagram Metrics
- **Endpoint**: `GET /{media_id}/insights`
- **Metrics**: `impressions`, `reach`, `engagement`, `likes`, `saves`, `comments`, `shares`
- **Helper**: `fetchMediaInsights(accessToken, mediaId)` in `lib/social/instagram.ts`
- **Notes**:
  - Throws `TOKEN_EXPIRED` error on 401
  - Returns empty object on 400 (insights not available)

### TikTok Metrics
- **Endpoint**: `POST /v2/research/video/query/`
- **Metrics**: `view_count`, `like_count`, `comment_count`, `share_count`, `play_count`
- **Helper**: `fetchVideoMetrics(accessToken, videoIds[])` in `lib/social/tiktok.ts`
- **Notes**:
  - Batch fetch for multiple videos
  - Returns map of `video_id` → metrics
  - Throws `TOKEN_EXPIRED` on 401

### Facebook Metrics
- **Status**: Not yet implemented (TODO in `metrics-refresh-service.ts`)

### Problems Identified
- Metrics helpers live in `lib/social/` but publishing is in `lib/studio/`
- Inconsistent error handling (string errors vs typed errors)
- No centralized retry logic
- Rate limiting handled manually with delays

---

## 4. Account Health Checks

### Current Status
- **Not Implemented**: No dedicated health check endpoint
- **Token Expiry Check**: `isTokenExpired()` in `social-account-service.ts`
  - Checks `expires_at` with 5-minute buffer
  - Does not verify token is actually valid

### Opportunities
- Add `checkAccountHealth()` to each platform client
- Use lightweight API calls (e.g., `GET /me` for Facebook, profile fetch for TikTok)
- Cache health status to avoid excessive API calls

---

## 5. Competitor Metrics

### Current Implementation
- **File**: `lib/studio/competitor-service.ts`
- **Status**: **Stubbed** - No real API calls yet
- **Functions**:
  - `fetchInstagramCompetitorMetrics()` - Returns mock data
  - `fetchTikTokCompetitorMetrics()` - Returns mock data
  - `fetchFacebookCompetitorMetrics()` - Returns mock data
- **Notes**: Clearly marked as stubs, ready for real implementation

---

## 6. Error Handling

### Current Error Types
- **File**: `lib/studio/errors.ts`
- **Types**:
  - `PlatformAPIError` - Platform API failures
  - `TokenExpiredError` - OAuth token expired
  - `RateLimitError` - Rate limit exceeded
  - `MissingDataError` - Required data not found
- **Notes**: Well-structured, but not consistently used across all API calls

### Problems Identified
- `publish-service.ts` returns `PublishResult` instead of throwing typed errors
- Some functions throw generic `Error` with `TOKEN_EXPIRED` message
- Inconsistent error metadata (some include status codes, some don't)

---

## 7. Logging

### Current Implementation
- **File**: `lib/studio/logging.ts`
- **Functions**:
  - `logInfo()`, `logWarn()`, `logError()`
  - `logPlatformAPICall()` - Logs API calls with duration, status, error
  - `logRetry()` - Logs retry attempts
- **Notes**: Good foundation, but not used consistently

### Problems Identified
- `publish-service.ts` uses `logPlatformAPICall` but signature doesn't match (expects different params)
- Some API calls don't log at all
- No centralized request/response logging

---

## 8. Environment Variables

### Current Usage
- **Facebook/Instagram**:
  - `FACEBOOK_APP_ID`
  - `FACEBOOK_APP_SECRET`
  - `NEXT_PUBLIC_BASE_URL` (for OAuth redirects)
- **TikTok**:
  - `TIKTOK_CLIENT_KEY`
  - `TIKTOK_CLIENT_SECRET`
  - `NEXT_PUBLIC_BASE_URL`
- **API Versions**: Hardcoded (`v19.0` for Facebook, `v2` for TikTok)

### Problems Identified
- No centralized config
- API versions hardcoded
- No validation of required env vars at startup

---

## 9. Token Refresh

### Current Status
- **Not Implemented**: No automatic token refresh
- **Token Exchange**: Facebook callback exchanges short-lived for long-lived token
- **Expiry Check**: `isTokenExpired()` checks timestamp but doesn't refresh

### Opportunities
- Implement refresh logic in platform clients
- Store refresh tokens (TikTok has them, Facebook doesn't)
- Auto-refresh before expiry

---

## 10. Rate Limiting

### Current Handling
- **Manual Delays**: `DELAY_BETWEEN_BATCHES_MS`, `DELAY_BETWEEN_REQUESTS_MS` in metrics refresh
- **No Retry Logic**: Some functions return `retryable: true` but no automatic retry
- **No Rate Limit Detection**: Doesn't parse `Retry-After` headers

### Opportunities
- Parse `Retry-After` headers
- Implement exponential backoff
- Track rate limit windows per platform

---

## Summary of Problems

1. **Scattered Logic**: Publishing, metrics, and OAuth logic spread across multiple files
2. **Inconsistent Patterns**: Different error handling, logging, and retry strategies
3. **Hardcoded Values**: API versions, base URLs, delays
4. **No Abstraction**: Platform-specific code duplicated
5. **Missing Features**: Token refresh, health checks, proper rate limiting

---

## Proposed Solution

Create centralized platform clients (`lib/studio/platform-clients/`) that:
- Abstract platform-specific API calls
- Provide consistent error handling and logging
- Support token refresh and health checks
- Handle rate limiting automatically
- Use typed configuration from environment variables

