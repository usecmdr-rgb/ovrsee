# Studio Social APIs Test Plan

## Overview

This document outlines manual tests to verify the platform clients, token refresh, and integration work correctly.

---

## Prerequisites

- At least one workspace with connected social accounts (Instagram, TikTok, Facebook)
- Test posts scheduled for each platform
- Access to Studio UI and API endpoints

---

## Test Cases

### 1. OAuth Connection Flow

#### 1.1 Instagram Connection
- [ ] Navigate to `/studio/settings/social-accounts`
- [ ] Click "Connect Instagram"
- [ ] Complete OAuth flow
- [ ] Verify account appears as "Connected" with handle
- [ ] Verify token stored in `studio_social_accounts` table

#### 1.2 TikTok Connection
- [ ] Click "Connect TikTok"
- [ ] Complete OAuth flow (PKCE)
- [ ] Verify account appears as "Connected" with handle
- [ ] Verify refresh token stored

#### 1.3 Facebook Connection
- [ ] Click "Connect Facebook"
- [ ] Complete OAuth flow
- [ ] Verify account appears as "Connected" with handle
- [ ] Verify long-lived token stored

---

### 2. Token Refresh

#### 2.1 Proactive Refresh (24h threshold)
- [ ] Set token `expires_at` to 23 hours from now
- [ ] Trigger any API call (publish, metrics refresh, health check)
- [ ] Verify token refreshed automatically
- [ ] Verify new `expires_at` is > 24 hours from now
- [ ] Verify API call succeeds

#### 2.2 Expired Token Refresh
- [ ] Set token `expires_at` to 1 hour ago
- [ ] Trigger API call
- [ ] Verify token refreshed automatically (if refresh supported)
- [ ] Verify API call succeeds after refresh

#### 2.3 Token Refresh Failure
- [ ] Set invalid refresh token
- [ ] Trigger API call
- [ ] Verify `TokenExpiredError` thrown
- [ ] Verify error logged
- [ ] Verify user-friendly error message returned

---

### 3. Publishing

#### 3.1 Instagram Post Publishing
- [ ] Create draft post with image
- [ ] Schedule for immediate publish
- [ ] Wait for cron to run (or trigger manually)
- [ ] Verify post appears on Instagram
- [ ] Verify `platform_post_id` stored
- [ ] Verify `post_url` stored
- [ ] Verify status = "posted"

#### 3.2 Instagram Reels Publishing
- [ ] Create draft post with video
- [ ] Schedule for immediate publish
- [ ] Verify video processing poll works
- [ ] Verify post appears on Instagram as Reel
- [ ] Verify status = "posted"

#### 3.3 Facebook Post Publishing
- [ ] Create draft post with image
- [ ] Schedule for immediate publish
- [ ] Verify post appears on Facebook Page
- [ ] Verify `platform_post_id` stored
- [ ] Verify status = "posted"

#### 3.4 TikTok Video Publishing
- [ ] Create draft post with video
- [ ] Schedule for immediate publish
- [ ] Verify three-step upload process works
- [ ] Verify post appears on TikTok
- [ ] Verify `platform_post_id` stored
- [ ] Verify status = "posted"

#### 3.5 Publishing with Expired Token
- [ ] Set token `expires_at` to past
- [ ] Create draft post
- [ ] Schedule for immediate publish
- [ ] Verify token refreshed automatically
- [ ] Verify post publishes successfully

#### 3.6 Publishing Failure Handling
- [ ] Disconnect account (or set invalid token)
- [ ] Create draft post
- [ ] Schedule for immediate publish
- [ ] Verify status = "failed"
- [ ] Verify `last_publish_error` contains user-friendly message
- [ ] Verify error logged

---

### 4. Metrics Refresh

#### 4.1 Instagram Metrics Refresh
- [ ] Ensure at least one posted Instagram post exists
- [ ] Trigger metrics refresh cron (or manually)
- [ ] Verify metrics appear in `studio_social_post_metrics`
- [ ] Verify metrics include: impressions, likes, comments, shares, saves
- [ ] Verify `captured_at` timestamp recorded

#### 4.2 TikTok Metrics Refresh
- [ ] Ensure at least one posted TikTok video exists
- [ ] Trigger metrics refresh cron
- [ ] Verify metrics appear in `studio_social_post_metrics`
- [ ] Verify metrics include: views, likes, comments, shares

#### 4.3 Facebook Metrics Refresh
- [ ] Ensure at least one posted Facebook post exists
- [ ] Trigger metrics refresh cron
- [ ] Verify metrics appear in `studio_social_post_metrics`
- [ ] Verify metrics include: impressions, reach, engagement, likes

#### 4.4 Rate Limit Handling
- [ ] Trigger metrics refresh for many posts (> 50)
- [ ] Verify rate limit errors caught and logged
- [ ] Verify job continues with other posts
- [ ] Verify `RateLimitError` logged with `retry_after`

#### 4.5 Partial Failure Handling
- [ ] Ensure mix of valid and invalid post IDs
- [ ] Trigger metrics refresh
- [ ] Verify valid posts get metrics
- [ ] Verify invalid posts logged as errors
- [ ] Verify job completes (doesn't crash)

---

### 5. Account Health Check

#### 5.1 Status Endpoint - Healthy Accounts
- [ ] Call `GET /api/studio/social/status`
- [ ] Verify all connected accounts return `status: "ok"`
- [ ] Verify `handle` and `lastCheckedAt` populated
- [ ] Verify response structure matches `AccountStatus[]`

#### 5.2 Status Endpoint - Expired Token
- [ ] Set token `expires_at` to past
- [ ] Call status endpoint
- [ ] Verify account returns `status: "token_expired"`
- [ ] Verify message indicates need to reconnect

#### 5.3 Status Endpoint - Expiring Token
- [ ] Set token `expires_at` to 12 hours from now
- [ ] Call status endpoint
- [ ] Verify account returns `status: "token_expiring"`
- [ ] Verify message indicates auto-refresh will happen

#### 5.4 Status Endpoint - Permissions Missing
- [ ] Revoke platform permissions (if possible)
- [ ] Call status endpoint
- [ ] Verify account returns `status: "permissions_missing"`
- [ ] Verify error message indicates permission issue

---

### 6. Competitor Metrics (v1 - Stubbed)

#### 6.1 Competitor Refresh Cron
- [ ] Add competitor account
- [ ] Trigger competitor refresh cron
- [ ] Verify cron completes without crashing
- [ ] Verify `logInfo` logged (not `logError`)
- [ ] Verify no metrics created (stub returns null)

#### 6.2 Competitor List
- [ ] Call `GET /api/studio/competitors`
- [ ] Verify competitors listed
- [ ] Verify no errors thrown for stubbed metrics

---

### 7. Error Handling

#### 7.1 Token Expired Error
- [ ] Trigger API call with expired token
- [ ] Verify `TokenExpiredError` thrown
- [ ] Verify error logged with platform context
- [ ] Verify user-friendly error message

#### 7.2 Rate Limit Error
- [ ] Trigger many rapid API calls
- [ ] Verify `RateLimitError` thrown
- [ ] Verify `retry_after` parsed from headers
- [ ] Verify error logged

#### 7.3 Platform API Error
- [ ] Trigger API call with invalid data
- [ ] Verify `PlatformAPIError` thrown
- [ ] Verify `retryable` flag set correctly
- [ ] Verify error logged with status code

---

### 8. Logging

#### 8.1 API Call Logging
- [ ] Trigger any platform API call
- [ ] Verify `logPlatformAPICall` called
- [ ] Verify log includes: platform, endpoint, method, status, duration
- [ ] Verify errors logged to `studio_logs` table

#### 8.2 Token Refresh Logging
- [ ] Trigger token refresh
- [ ] Verify refresh attempt logged
- [ ] Verify success/failure logged
- [ ] Verify duration logged

---

## Expected Behaviors

### Success Cases
- All API calls succeed with valid tokens
- Token refresh happens automatically before expiry
- Metrics refresh completes without crashing
- Status endpoint returns accurate health information

### Failure Cases
- Expired tokens trigger refresh (if supported) or clear error
- Rate limits handled gracefully with retry-after
- Partial failures don't crash entire job
- All errors logged with context

### Edge Cases
- Missing account IDs handled gracefully
- Invalid platform handled with clear error
- Empty post lists handled without errors
- Concurrent requests handled correctly

---

## Notes

- No automated tests required for v1
- Focus on manual verification of happy paths and error cases
- Code structured to be testable (platform clients isolated)
- Logs provide debugging information for failures

