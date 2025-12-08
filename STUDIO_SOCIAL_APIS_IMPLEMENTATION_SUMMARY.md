# Studio Social APIs Implementation Summary

## Overview

Refactored Studio's social media integrations (Instagram, TikTok, Facebook) to use centralized platform clients with consistent error handling, logging, and token management.

---

## New Files

### Platform Clients

- `lib/studio/platform-clients/types.ts` - Shared TypeScript types
- `lib/studio/platform-clients/config.ts` - Environment variable configuration
- `lib/studio/platform-clients/http-helper.ts` - Shared HTTP request helper with error handling
- `lib/studio/platform-clients/instagram-client.ts` - Instagram Business API client
- `lib/studio/platform-clients/facebook-client.ts` - Facebook Graph API client
- `lib/studio/platform-clients/tiktok-client.ts` - TikTok Content Publishing API client
- `lib/studio/platform-clients/index.ts` - Exports

### API Endpoints

- `app/api/studio/social/status/route.ts` - Account health status endpoint

### Documentation

- `STUDIO_SOCIAL_APIS_DISCOVERY.md` - Current implementation analysis
- `STUDIO_PLATFORM_CLIENTS_IMPLEMENTATION.md` - Platform clients architecture
- `STUDIO_SOCIAL_APIS_TEST_PLAN.md` - Manual test plan
- `STUDIO_SOCIAL_APIS_IMPLEMENTATION_SUMMARY.md` - This document

---

## Refactored Files

### 1. `lib/studio/social-account-service.ts`

**Added:**
- `ensureFreshAccessToken()` - Token refresh helper
  - Checks if token expires within 24 hours
  - Automatically refreshes TikTok tokens (refresh token flow)
  - Automatically refreshes Facebook/Instagram tokens (long-lived exchange)
  - Returns fresh token or throws `TokenExpiredError`

**Helper Functions:**
- `refreshTikTokToken()` - TikTok refresh token flow
- `refreshFacebookToken()` - Facebook long-lived token exchange

### 2. `lib/studio/publish-service.ts`

**Refactored:**
- Removed platform-specific functions (`publishToInstagram`, `publishToTikTok`, `publishToFacebook`)
- `publishPost()` now:
  1. Gets account via `getSocialAccount()`
  2. Ensures fresh token via `ensureFreshAccessToken()`
  3. Calls appropriate platform client (`publishInstagram`, `publishFacebook`, `publishTikTok`)
  4. Handles typed errors (`TokenExpiredError`, `RateLimitError`, `PlatformAPIError`)
  5. Logs all operations

**Error Handling:**
- `TokenExpiredError` → User-friendly message, `retryable: false`
- `RateLimitError` → User-friendly message, `retryable: true`
- `PlatformAPIError` → Error message, `retryable` based on status code

### 3. `lib/studio/metrics-refresh-service.ts`

**Refactored:**
- Removed direct API calls (`fetchMediaInsights`, `fetchVideoMetrics`)
- Platform-specific refresh functions now:
  1. Get account via `getSocialAccount()`
  2. Ensure fresh token via `ensureFreshAccessToken()`
  3. Call platform client `fetchPostMetrics()` methods
  4. Handle typed errors gracefully
  5. Continue processing on partial failures

**Added:**
- `refreshFacebookMetrics()` - Facebook metrics refresh (previously stubbed)

**Error Handling:**
- `TokenExpiredError` → Log warning, return early with error
- `RateLimitError` → Log warning, continue with other posts
- `PlatformAPIError` → Log error, continue with other posts

### 4. `lib/studio/competitor-service.ts`

**Status:**
- Already stubbed correctly
- Uses `logInfo` (not `logError`) for stub calls
- Returns `null` when APIs not available
- Cron handles missing metrics gracefully

**Future:**
- Can be updated to use platform clients when real APIs available

---

## Platform Support

### Instagram

**Post Types:**
- ✅ Single-image feed posts
- ✅ Reels (video)

**Implementation:**
- `publishPost()` - Two-step: create container → publish (with video polling)
- `fetchPostMetrics()` - Insights API (`/{media_id}/insights`)
- `checkAccountHealth()` - Account info (`/{ig_business_id}?fields=id,username,name`)

**Token Refresh:**
- Long-lived token exchange (`fb_exchange_token`)

### Facebook

**Post Types:**
- ✅ Page text + image posts
- ✅ Page video posts

**Implementation:**
- `publishPost()` - Direct POST to `/{page_id}/photos` or `/{page_id}/videos`
- `fetchPostMetrics()` - Insights API (`/{post_id}/insights`)
- `checkAccountHealth()` - Page info (`/{page_id}?fields=id,name`)

**Token Refresh:**
- Long-lived token exchange (`fb_exchange_token`)

### TikTok

**Post Types:**
- ✅ Video upload + publish

**Implementation:**
- `publishPost()` - Three-step: init → upload → publish
- `fetchPostMetrics()` - Research API (`/research/video/query/`)
- `checkAccountHealth()` - User info (`/user/info/`)

**Token Refresh:**
- Refresh token flow (`grant_type=refresh_token`)

---

## Token Lifecycle

### Refresh Behavior

1. **Token expires > 24 hours**: Return current token (no refresh needed)
2. **Token expires ≤ 24 hours**: Proactively refresh
3. **Token expired**: Attempt refresh, throw `TokenExpiredError` if fails

### Platform-Specific Refresh

- **TikTok**: Uses refresh token (`refresh_token` grant type)
- **Facebook/Instagram**: Uses long-lived token exchange (`fb_exchange_token`)

### Error Handling

- Refresh failures throw `TokenExpiredError`
- Errors logged with platform context
- User-friendly error messages returned

---

## Error Handling

### Typed Errors

- `TokenExpiredError` - OAuth token expired/invalid
- `RateLimitError` - Rate limit exceeded (includes `retryAfter`)
- `PlatformAPIError` - Other API failures (includes `retryable` flag)

### Error Flow

1. Platform client throws typed error
2. Service catches and logs error
3. Service converts to user-friendly message
4. Error returned in API response or stored in `last_publish_error`

### Logging

- All API calls logged via `logPlatformAPICall`
- Errors logged via `logError` with context
- Rate limits logged via `logWarn` with retry-after

---

## API Endpoints

### New Endpoints

#### `GET /api/studio/social/status`

Returns health status for all connected social accounts.

**Response:**
```json
{
  "ok": true,
  "data": {
    "accounts": [
      {
        "accountId": "uuid",
        "platform": "instagram",
        "handle": "@username",
        "status": "ok" | "token_expiring" | "token_expired" | "permissions_missing" | "unknown_error",
        "message": "Account is healthy",
        "lastCheckedAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

**Status Values:**
- `ok` - Account healthy, token valid
- `token_expiring` - Token expires within 24h, will auto-refresh
- `token_expired` - Token expired, needs reconnect
- `permissions_missing` - API permissions insufficient
- `unknown_error` - Other error (see message)

---

## Current Limitations

### Competitor Metrics

- **Status**: Stubbed for v1
- **Reason**: Public APIs not available/not implemented
- **Behavior**: Returns `null`, logs `logInfo` (not error)
- **Future**: Can implement using platform clients when APIs available

### Facebook Metrics

- **Status**: Implemented but may have limited data
- **Reason**: Facebook Insights API requires specific permissions
- **Behavior**: Returns empty metrics if not available

### Rate Limiting

- **Status**: Detected and logged, but no automatic retry
- **Future**: Can add exponential backoff and retry queue

---

## Migration Notes

### Backward Compatibility

- ✅ All existing endpoints preserved
- ✅ All existing functionality preserved
- ✅ Database schemas unchanged
- ✅ API contracts unchanged

### Breaking Changes

- None - all changes are internal refactoring

### Gradual Migration

- Platform clients can be used alongside old code
- Old platform-specific functions removed from `publish-service.ts`
- Old helper functions (`fetchMediaInsights`, `fetchVideoMetrics`) still exist in `lib/social/` but not used

---

## Testing

See `STUDIO_SOCIAL_APIS_TEST_PLAN.md` for manual test cases.

**Key Test Areas:**
1. OAuth connection flow
2. Token refresh (proactive and expired)
3. Publishing (all platforms)
4. Metrics refresh (all platforms)
5. Account health checks
6. Error handling (token expired, rate limits, API errors)

---

## Next Steps

### Phase 2 Enhancements

1. **Automatic Retry**
   - Implement exponential backoff for retryable errors
   - Queue failed requests for retry

2. **Rate Limit Queue**
   - Track rate limit windows per platform
   - Queue requests when rate limited

3. **Competitor Metrics**
   - Implement real API calls when available
   - Use platform clients for consistency

4. **Health Check Caching**
   - Cache health check results (5-10 minutes)
   - Reduce API calls

5. **Token Refresh Optimization**
   - Batch token refreshes
   - Pre-refresh tokens before scheduled jobs

---

## Summary

✅ **Platform clients created** - Clean abstraction for Instagram, TikTok, Facebook  
✅ **Token refresh implemented** - Automatic refresh before expiry  
✅ **Publish service refactored** - Uses platform clients  
✅ **Metrics service refactored** - Uses platform clients  
✅ **Status endpoint created** - Account health monitoring  
✅ **Error handling improved** - Typed errors, consistent logging  
✅ **Backward compatible** - No breaking changes  

The codebase is now more maintainable, testable, and production-ready.

