# Studio Competitor & Trend Intelligence - Discovery

## Overview

This document outlines the approach for implementing competitor tracking and basic trend intelligence in Studio.

## Current State Analysis

### 1. Workspace Metrics Querying

**Location**: `lib/studio/metrics-summary-service.ts`

**Key Functions**:
- `computeMetricsSummary(workspaceId, periodDays, supabaseClient, periodStart?, periodEnd?)`:
  - Fetches posts from `studio_social_posts` filtered by workspace and date range
  - Joins with `studio_social_post_metrics` to get time-series metrics
  - Aggregates per platform: total posts, avg engagement, posting frequency
  - Computes best day-of-week and time windows
  - Returns `MetricsSummary` with platform breakdowns

**Query Pattern**:
```typescript
// Posts with latest metrics
const { data: posts } = await supabase
  .from("studio_social_posts")
  .select(`
    *,
    studio_social_post_metrics (
      impressions,
      views,
      likes,
      comments,
      shares,
      saves,
      captured_at
    )
  `)
  .eq("workspace_id", workspaceId)
  .gte("posted_at", thresholdDate)
```

### 2. Platform API Access

**Current Integrations**:
- Instagram: Facebook Graph API (via `lib/social/instagram.ts`)
- TikTok: TikTok Open API (via `lib/social/tiktok.ts`)
- Facebook: Facebook Graph API

**Constraints**:
- Instagram: Requires Business Account, Graph API access
- TikTok: Limited public data access
- Facebook: Graph API with appropriate permissions

**For Competitor Metrics**:
- Instagram: Can fetch public profile data if account is public (followers, post count)
- TikTok: Limited - may need to use public profile endpoints if available
- Facebook: Similar to Instagram, public page data

**Note**: For v1, we'll structure the code to support real API calls but may need to stub some functions if APIs don't provide public competitor data easily.

### 3. Existing Competitor References

**Search Results**: No existing competitor tracking found.

**Conclusion**: Clean slate for competitor intelligence.

## Design Decisions

### Competitor Model

**`studio_competitors` table**:
- Stores competitor accounts per workspace
- Platform + handle (username/identifier)
- Optional label for user-friendly naming

**`studio_competitor_metrics` table**:
- Time-series snapshots of competitor metrics
- Followers, post count, engagement estimates
- Captured periodically via cron

### Metric Fetching Strategy

**Pluggable Functions**:
- `fetchInstagramCompetitorMetrics(handle)`
- `fetchTikTokCompetitorMetrics(handle)`
- `fetchFacebookCompetitorMetrics(handle)`

**For v1**:
- Structure code to support real API calls
- If APIs don't support public competitor data, return:
  - Stub data with clear TODOs
  - Or `null` with graceful handling

### Integration Points

1. **Reports**: Include competitor comparisons in weekly report context
2. **Planner**: Factor competitor posting frequency into suggestions
3. **Agent**: Answer questions about competitor comparisons
4. **UI**: Simple competitors management page

### Trend Intelligence v1

**Basic Trends**:
- Posting frequency comparison (you vs competitors)
- Engagement rate comparison
- Simple insights: "They post more/less than you"

**No External Trend APIs**:
- Use only data from existing social APIs
- If not available, use placeholder functions
- Wire data flow for future enhancement

## Files to Create/Modify

### New Files
- `supabase/migrations/20250130000000_studio_competitors_schema.sql`
- `lib/studio/competitor-service.ts`
- `app/api/cron/studio/competitors-refresh/route.ts`
- `app/api/studio/competitors/route.ts`
- `app/api/studio/competitors/[id]/route.ts` (optional)
- `app/studio/competitors/page.tsx`
- `STUDIO_COMPETITORS_IMPLEMENTATION_SUMMARY.md`

### Modified Files
- `lib/studio/report-service.ts` (include competitor context)
- `lib/studio/metrics-summary-service.ts` (optional: competitor summary helper)
- `app/api/studio/plans/weekly/route.ts` (include competitor context)
- `app/api/studio/agent/chat/route.ts` (mention competitor awareness)
- `vercel.json` (add cron for competitor refresh)

## Constraints

- Backwards compatible: no breaking changes
- Workspace-scoped: all competitor data tied to workspace
- Graceful degradation: if APIs unavailable, still show UI and structure
- Simple v1: basic metrics only, no complex trend analysis

## Next Steps

1. Create schema migration
2. Implement competitor service with pluggable metric fetching
3. Create APIs
4. Add cron job
5. Integrate with reports and planner
6. Build UI
7. Document implementation

