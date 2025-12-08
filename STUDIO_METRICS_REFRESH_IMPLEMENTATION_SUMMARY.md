# Studio Automatic Metrics Refresh Implementation Summary

## Overview

Implemented a scheduled job that periodically refreshes metrics (impressions, likes, comments, shares, saves, views) for recent social media posts, ensuring Studio's analytics stay up-to-date without manual intervention.

## Current Metrics Logic Discovery

### How Metrics Are Fetched

1. **Instagram**:
   - `fetchInstagramMediaWithInsights()` in `lib/social/instagram.ts`
   - Uses Instagram Graph API `/media/{media-id}/insights` endpoint
   - Fetches: impressions, reach, engagement, likes, saves, comments, shares
   - Rate limiting: 200ms delay between requests

2. **TikTok**:
   - `fetchTikTokVideosWithMetrics()` in `lib/social/tiktok.ts`
   - Uses TikTok Research API `/research/video/query/` endpoint
   - Fetches: view_count, like_count, comment_count, share_count, play_count
   - Batch processing for multiple videos

3. **Facebook**:
   - Not yet implemented (uses same Graph API as Instagram, can be added later)

### How Metrics Are Stored

- **Table**: `studio_social_post_metrics`
- **Structure**: Time-series table with:
  - `social_post_id` (FK to `studio_social_posts`)
  - `captured_at` (timestamp for time-series)
  - Metrics: `impressions`, `views`, `likes`, `comments`, `shares`, `saves`
  - `metadata` (JSONB for platform-specific data)
- **Unique Constraint**: `(social_post_id, captured_at)` - allows multiple snapshots per post
- **Indexes**: On `social_post_id` and `captured_at` for efficient queries

### How Metrics Are Read

- **Analytics Endpoints**: Read latest metrics by ordering `captured_at DESC` and taking first result
- **Example**: `app/api/studio/analytics/posts/route.ts` gets latest metric per post
- **Time-series Support**: Table structure supports historical tracking, but currently only latest is used

## Refresh Scope Definition

### Time Window
- **Refresh Window**: Last 30 days of posts (`REFRESH_WINDOW_DAYS = 30`)
- **Rationale**: 
  - Recent posts have active metrics that change frequently
  - Older posts have stable metrics (less value in frequent refresh)
  - Balances freshness with API rate limits

### Metrics Updated
- **Instagram**: impressions, likes, comments, shares, saves
- **TikTok**: views, likes, comments, shares
- **Facebook**: Not yet implemented (can use same approach as Instagram)

### Posts Included
- Posts with `posted_at` within last 30 days
- Posts with `external_post_id` (published posts only)
- Posts from connected accounts (`status = 'connected'`)

## Implementation

### 1. Metrics Refresh Service

**File**: `lib/studio/metrics-refresh-service.ts`

Created service layer with:

- **`refreshInstagramMetrics()`**:
  - Fetches fresh insights for each post
  - Processes in batches of 10 posts
  - 200ms delay between requests
  - 2 second delay between batches
  - Handles token expiry gracefully

- **`refreshTikTokMetrics()`**:
  - Fetches metrics for batch of videos
  - Processes in batches of 10 posts
  - 2 second delay between batches
  - Handles token expiry gracefully

- **`refreshWorkspaceMetrics()`**:
  - Refreshes metrics for all connected accounts in a workspace
  - Processes each platform separately
  - Returns aggregated results

- **`refreshAllWorkspacesMetrics()`**:
  - Finds all workspaces with connected accounts
  - Processes each workspace sequentially
  - Returns aggregated results across all workspaces

**Rate Limiting Strategy**:
- Batch size: 10 posts per batch
- Delay between requests: 200ms (Instagram API)
- Delay between batches: 2 seconds
- Handles 429 (rate limit) errors gracefully
- Stops processing on token expiry

### 2. Cron Job Endpoint

**File**: `app/api/cron/studio/metrics-refresh/route.ts`

Created scheduled job endpoint:

- **GET `/api/cron/studio/metrics-refresh`**:
  - Verifies cron secret for security
  - Supports optional `workspace_id` parameter for testing
  - Refreshes metrics for all workspaces (or single workspace)
  - Returns aggregated summary and detailed results
  - Logs errors for monitoring

- **Configuration**: Added to `vercel.json`:
  - Schedule: Every 6 hours (`0 */6 * * *`)
  - Rationale: Balances freshness with API rate limits

### 3. Data Model Considerations

**Current State**:
- `studio_social_post_metrics` already supports time-series
- Unique constraint on `(social_post_id, captured_at)` allows multiple snapshots
- Each refresh creates a new metrics record with current timestamp

**Implementation Approach**:
- **Time-series snapshots**: Each refresh creates a new record (preserves history)
- **Latest metrics**: Analytics endpoints read latest by `captured_at DESC`
- **Idempotency**: Safe to run repeatedly (creates new snapshot each time)
- **No schema changes**: Uses existing table structure

**Future Enhancement**:
- Could add cleanup job to remove old snapshots (keep only daily/weekly snapshots)
- Could add aggregation table for faster analytics queries
- Could add metrics comparison (day-over-day, week-over-week)

### 4. UI Integration

**No UI Changes Required**:
- Existing analytics endpoints already read latest metrics
- `app/api/studio/analytics/posts/route.ts` queries latest `captured_at`
- Calendar and analytics views will automatically show refreshed data
- Metrics refresh happens in background, transparent to users

**Verification**:
- Analytics endpoints use: `.order("captured_at", { ascending: false }).limit(1)`
- This ensures latest metrics are always displayed
- No changes needed to existing UI components

## Files Created

1. `lib/studio/metrics-refresh-service.ts` - Metrics refresh service
2. `app/api/cron/studio/metrics-refresh/route.ts` - Cron job endpoint
3. `STUDIO_METRICS_REFRESH_IMPLEMENTATION_SUMMARY.md` - This file

## Files Modified

1. `vercel.json` - Added metrics refresh cron job (every 6 hours)

## API Endpoints

### GET /api/cron/studio/metrics-refresh

**Query Parameters:**
- `secret` (optional): Cron secret for authentication
- `workspace_id` (optional): Refresh only specific workspace (for testing)

**Response:**
```json
{
  "ok": true,
  "message": "Refreshed metrics for X posts across Y platform connections",
  "summary": {
    "totalPostsProcessed": 150,
    "totalMetricsUpdated": 145,
    "totalErrors": 5,
    "byPlatform": {
      "instagram": { "processed": 100, "updated": 98, "errors": 2 },
      "tiktok": { "processed": 50, "updated": 47, "errors": 3 }
    }
  },
  "details": [
    {
      "platform": "instagram",
      "workspaceId": "uuid",
      "postsProcessed": 25,
      "metricsUpdated": 24,
      "errors": ["Post abc: Rate limit exceeded"]
    }
  ]
}
```

## Rate Limiting & Safety

### Rate Limit Handling

1. **Batching**:
   - Processes posts in batches of 10
   - Prevents overwhelming API endpoints

2. **Delays**:
   - 200ms between individual Instagram API requests
   - 2 seconds between batches
   - Prevents hitting rate limits

3. **Error Handling**:
   - Continues processing on individual post errors
   - Stops on token expiry (prevents unnecessary API calls)
   - Logs all errors for monitoring

4. **Idempotency**:
   - Safe to run repeatedly
   - Creates new snapshot each time (doesn't overwrite)
   - No side effects from multiple runs

### Platform-Specific Considerations

1. **Instagram**:
   - Rate limit: ~200 requests per hour per user
   - Current implementation: ~50 requests per workspace per run (30 posts / 10 batch = 3 batches)
   - With 6-hour schedule: Well within limits

2. **TikTok**:
   - Rate limit: Varies by API product
   - Current implementation: Batch queries (more efficient)
   - Processes multiple videos in single request

3. **Facebook**:
   - Not yet implemented
   - Can use same approach as Instagram (same Graph API)

## Follow-up Ideas for Advanced Analytics

### Short-term Enhancements

1. **Metrics Comparison**:
   - Calculate day-over-day changes
   - Show growth/decline trends
   - Highlight significant changes

2. **Refresh Frequency Optimization**:
   - More frequent refresh for very recent posts (first 24-48 hours)
   - Less frequent for older posts (weekly)
   - Adaptive refresh based on post age

3. **Error Recovery**:
   - Retry failed posts on next run
   - Track which posts consistently fail
   - Alert on persistent failures

### Medium-term Enhancements

1. **Metrics Aggregation**:
   - Pre-computed daily/weekly aggregates
   - Faster analytics queries
   - Historical trend analysis

2. **Engagement Rate Calculation**:
   - Calculate engagement rate (likes + comments + shares) / impressions
   - Track engagement trends
   - Compare to industry benchmarks

3. **Best Time Analysis**:
   - Analyze performance by posting time
   - Suggest optimal posting times
   - Track performance patterns

4. **Content Performance Scoring**:
   - Score posts based on multiple metrics
   - Identify top-performing content
   - Suggest content strategies

### Long-term Vision

1. **Predictive Analytics**:
   - Predict post performance before publishing
   - Estimate reach and engagement
   - A/B test suggestions

2. **Competitor Analysis**:
   - Compare metrics to industry averages
   - Benchmark against competitors
   - Identify improvement opportunities

3. **Automated Insights**:
   - AI-generated insights from metrics
   - Automatic anomaly detection
   - Proactive recommendations

4. **Real-time Metrics**:
   - Webhook integration for real-time updates
   - Live metrics dashboard
   - Instant notifications on milestones

5. **Advanced Time-series Analysis**:
   - Growth rate calculations
   - Seasonal pattern detection
   - Forecasting future performance

## Testing Recommendations

1. **Unit Tests**:
   - Test batch processing logic
   - Test rate limiting delays
   - Test error handling

2. **Integration Tests**:
   - Test full refresh flow for each platform
   - Test with various post counts
   - Test with expired tokens

3. **E2E Tests**:
   - Test cron job execution
   - Verify metrics are updated in database
   - Verify analytics endpoints return fresh data

4. **Load Tests**:
   - Test with large number of posts
   - Verify rate limiting works correctly
   - Test concurrent workspace processing

## Monitoring & Alerts

### Recommended Monitoring

1. **Success Rate**:
   - Track percentage of posts successfully refreshed
   - Alert if success rate drops below threshold

2. **Error Patterns**:
   - Monitor for recurring errors
   - Track token expiry frequency
   - Alert on rate limit hits

3. **Performance**:
   - Track job execution time
   - Monitor API response times
   - Alert on slow performance

4. **Coverage**:
   - Track how many posts are refreshed per run
   - Monitor refresh frequency per post
   - Ensure all recent posts are covered

## Security Considerations

- Cron secret required for endpoint access
- Service role client used for database access
- Token validation before API calls
- No user data exposed in logs
- Workspace isolation enforced

## Performance Considerations

- Batch processing prevents API overload
- Efficient queries with proper indexes
- Time-series table supports high write volume
- Cron runs every 6 hours (not too frequent)
- Processes only recent posts (30-day window)

## Next Steps

1. **Test the implementation**:
   - Run cron job manually with test workspace
   - Verify metrics are updated correctly
   - Check analytics endpoints return fresh data

2. **Monitor first runs**:
   - Watch for rate limit issues
   - Monitor error rates
   - Adjust batch sizes/delays if needed

3. **Add Facebook support**:
   - Implement `refreshFacebookMetrics()` function
   - Use Instagram approach (same Graph API)

4. **Optimize refresh window**:
   - Consider adaptive refresh based on post age
   - More frequent for recent posts
   - Less frequent for older posts

