# Studio Hashtag Intelligence v1 Implementation Summary

## Overview

Implemented hashtag tracking, analytics, and AI-powered suggestions for Studio. The system tracks hashtag usage and performance, provides data-driven insights, and integrates with content generation to suggest effective hashtag sets.

## What Changed

### 1. Schema

**Migration**: `supabase/migrations/20250126000000_studio_hashtags_schema.sql`

**Tables Created**:

1. **`studio_hashtags`**:
   - `id` (UUID, primary key)
   - `workspace_id` (UUID, foreign key to workspaces)
   - `name` (TEXT, lowercase, without #)
   - `created_at`, `first_used_at`, `last_used_at` (timestamps)
   - Unique constraint: `(workspace_id, name)` - ensures one hashtag per workspace

2. **`studio_post_hashtags`** (Junction Table):
   - `post_id` (UUID, foreign key to studio_social_posts)
   - `hashtag_id` (UUID, foreign key to studio_hashtags)
   - `created_at` (timestamp)
   - Primary key: `(post_id, hashtag_id)`

**Indexes**:
- `idx_studio_hashtags_workspace_id` - For workspace queries
- `idx_studio_hashtags_name` - For name lookups
- `idx_studio_post_hashtags_post_id` - For post queries
- `idx_studio_post_hashtags_hashtag_id` - For hashtag queries

**Triggers**:
- `trigger_update_hashtag_last_used` - Updates `last_used_at` when hashtag is linked to a post

**RLS Policies**:
- Workspace-scoped access for both tables
- Members can view/insert/update hashtags
- Members can view/insert/delete post-hashtag links

### 2. Write Path

**File**: `lib/studio/hashtag-service.ts`

Created service functions:

- **`parseHashtags(caption)`**:
  - Extracts all `#hashtag` patterns from caption
  - Normalizes to lowercase
  - Removes duplicates
  - Returns array of hashtag names (without #)

- **`upsertPostHashtags(workspaceId, postId, caption)`**:
  - Parses hashtags from caption
  - Upserts hashtags into `studio_hashtags` (creates if new, updates `last_used_at` if exists)
  - Links hashtags to post via `studio_post_hashtags`
  - Removes old links before creating new ones (handles caption updates)

- **`getPostHashtags(postId)`**:
  - Returns array of hashtag names for a post

- **`backfillHashtagsFromPosts(workspaceId, limit)`**:
  - Processes existing posts to extract and store hashtags
  - Returns count of processed posts and hashtags found

**Integration Points**:

1. **`app/api/studio/posts/route.ts`** (POST):
   - After creating post, calls `upsertPostHashtags()`

2. **`app/api/studio/posts/[postId]/route.ts`** (PATCH):
   - If caption is updated, calls `upsertPostHashtags()`

3. **`app/api/studio/repurpose/route.ts`**:
   - After creating repurposed posts, calls `upsertPostHashtags()` for each

4. **`app/api/studio/plans/weekly/route.ts`**:
   - After creating weekly plan posts, calls `upsertPostHashtags()` for each

**Backfill Endpoint**: `app/api/studio/hashtags/backfill/route.ts`
- Allows manual backfill of existing posts
- Processes up to specified limit

### 3. Read Path / Analytics

**File**: `lib/studio/hashtag-analytics-service.ts`

Created analytics service:

- **`computeHashtagInsights(workspaceId, periodDays)`**:
  - Fetches hashtag usage and post metrics for specified period
  - Calculates per-hashtag metrics:
    - Usage count (number of posts)
    - Average impressions, views, likes, comments, shares, saves
    - Average engagement rate: `(likes + comments + shares + saves) / impressions` (or views for TikTok)
    - Total metrics
  - Returns top performers by:
    - Usage (most frequently used)
    - Engagement rate (highest performing, min 2 uses)
    - Impressions (highest reach)

- **`getTopHashtagsForSuggestions(workspaceId, limit, periodDays)`**:
  - Returns simplified list for LLM prompts
  - Combines top by engagement and usage
  - Sorted by engagement rate, then usage count

**API Endpoint**: `app/api/studio/hashtags/insights/route.ts`
- `GET /api/studio/hashtags/insights?period_days=30`
- Returns full `HashtagInsights` object

### 4. AI Integration

**Updated Prompts**:

1. **Weekly Planner** (`app/api/studio/plans/weekly/route.ts`):
   - Fetches top-performing hashtags
   - Includes in prompt: "Use 3-5 relevant ones per post"
   - Lists hashtags with engagement rates and usage counts

2. **Repurposing Service** (`lib/studio/repurposing-service.ts`):
   - Fetches top-performing hashtags
   - Includes in prompt: "Consider using 3-5 relevant ones"
   - Provides context for platform-specific hashtag selection

**Hashtag Suggestion Endpoint**: `app/api/studio/hashtags/suggest/route.ts`
- `POST /api/studio/hashtags/suggest`
- Accepts: `content_brief`, `platform`, `count`
- Returns: AI-generated hashtag suggestions
- Combines:
  - Top-performing hashtags from analytics
  - LLM-generated new hashtags based on content brief
  - Brand profile context
  - Platform-specific guidelines

**LLM Prompt Structure**:
```
System: You are a social media hashtag strategist...

User: Suggest [count] hashtags for this content:
Content Brief: [brief]
Platform: [platform]

Top-Performing Hashtags (from brand history):
1. #hashtag1 (engagement: X%, used Y times)
...

Guidance:
- Include 3-5 of the top-performing hashtags if relevant
- Add 5-7 new, relevant hashtags
- Mix high-performing known tags with exploratory ones

Brand Profile: [profile]
Platform Guidelines: [guidelines]
```

### 5. UI

**Component**: `components/studio/HashtagSuggestions.tsx`

Created React component for hashtag recommendations:

- **Features**:
  - "Suggest" button to get AI-powered hashtag suggestions
  - Displays suggested hashtags as clickable chips
  - Shows selected hashtags
  - "Apply All" button to add all suggestions
  - Toggle individual hashtags on/off
  - Calls `/api/studio/hashtags/suggest` endpoint

- **Integration**: Added to `components/studio/StudioIntelligence.tsx`
  - Shows hashtag suggestions below Studio Intelligence answers
  - Uses question as content brief

**Future UI Integration Points** (not yet implemented):
- Post editor: Show recommended hashtags with apply button
- Studio insights: Display "Top hashtags" list for last 30 days
- Analytics dashboard: Hashtag performance charts

## Files Created

1. `supabase/migrations/20250126000000_studio_hashtags_schema.sql` - Database schema
2. `lib/studio/hashtag-service.ts` - Hashtag parsing and storage service
3. `lib/studio/hashtag-analytics-service.ts` - Hashtag analytics service
4. `app/api/studio/hashtags/insights/route.ts` - Insights API endpoint
5. `app/api/studio/hashtags/suggest/route.ts` - Suggestion API endpoint
6. `app/api/studio/hashtags/backfill/route.ts` - Backfill API endpoint
7. `components/studio/HashtagSuggestions.tsx` - UI component
8. `STUDIO_HASHTAG_INTELLIGENCE_IMPLEMENTATION_SUMMARY.md` - This file

## Files Modified

1. `app/api/studio/posts/route.ts` - Added hashtag parsing on post creation
2. `app/api/studio/posts/[postId]/route.ts` - Added hashtag parsing on caption update
3. `app/api/studio/repurpose/route.ts` - Added hashtag parsing for repurposed posts
4. `app/api/studio/plans/weekly/route.ts` - Added hashtag intelligence to prompts
5. `lib/studio/repurposing-service.ts` - Added hashtag intelligence to prompts
6. `components/studio/StudioIntelligence.tsx` - Added HashtagSuggestions component

## Data Flow

### Caption → Hashtags

1. **Post Created/Updated**:
   - Caption stored in `studio_social_posts.caption`
   - `upsertPostHashtags()` called
   - Hashtags parsed from caption using regex: `/#([a-zA-Z0-9_]+)/g`
   - Each hashtag normalized to lowercase, stored in `studio_hashtags`
   - Links created in `studio_post_hashtags`

2. **Hashtag Storage**:
   - New hashtags: Created with `first_used_at = NOW()`
   - Existing hashtags: `last_used_at` updated via trigger

### Analytics → Insights

1. **Metrics Calculation**:
   - Query `studio_post_hashtags` joined with posts and metrics
   - Filter by workspace and date range
   - Aggregate metrics per hashtag:
     - Count posts using hashtag
     - Average impressions, views, likes, etc.
     - Calculate engagement rate per post, then average

2. **Top Performers**:
   - Sort by usage count → `top_by_usage`
   - Sort by engagement rate (min 2 uses) → `top_by_engagement`
   - Sort by average impressions → `top_by_impressions`

### Analytics → AI Suggestions

1. **Top Hashtags for Prompts**:
   - Fetch top by engagement and usage
   - Combine and deduplicate
   - Sort by engagement rate, then usage
   - Return simplified list with name, engagement_rate, usage_count

2. **LLM Integration**:
   - Top hashtags included in system prompts
   - Model instructed to use 3-5 relevant ones
   - Model can suggest new hashtags based on content

3. **Suggestion Endpoint**:
   - Combines top-performing hashtags with LLM suggestions
   - Returns mix of proven performers and new tags
   - Platform-specific guidance

## API Endpoints

### GET /api/studio/hashtags/insights

**Query Parameters**:
- `period_days` (optional, default: 30) - Number of days to analyze

**Response**:
```json
{
  "ok": true,
  "data": {
    "top_by_usage": [
      {
        "hashtag_id": "uuid",
        "name": "hashtag",
        "usage_count": 10,
        "avg_impressions": 1500,
        "avg_engagement_rate": 3.5,
        ...
      }
    ],
    "top_by_engagement": [...],
    "top_by_impressions": [...],
    "total_hashtags": 45,
    "period_days": 30
  }
}
```

### POST /api/studio/hashtags/suggest

**Request Body**:
```json
{
  "content_brief": "Post about new product launch",
  "platform": "instagram",
  "count": 10
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "suggested_hashtags": ["hashtag1", "hashtag2", ...],
    "top_performing_hashtags": [
      {
        "name": "hashtag",
        "engagement_rate": 3.5,
        "usage_count": 10
      }
    ]
  }
}
```

### POST /api/studio/hashtags/backfill

**Request Body**:
```json
{
  "limit": 1000
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "processed": 500,
    "hashtagsFound": 120
  }
}
```

## Key Features

### 1. Automatic Hashtag Extraction
- Parses hashtags from captions automatically
- Normalizes to lowercase
- Removes duplicates
- Updates on caption changes

### 2. Performance Tracking
- Tracks usage count per hashtag
- Calculates average engagement metrics
- Identifies top performers by multiple criteria
- Time-series support (first_used_at, last_used_at)

### 3. AI-Powered Suggestions
- Combines analytics with LLM generation
- Mixes proven performers with new tags
- Platform-specific optimization
- Brand-aware suggestions

### 4. Workspace Scoping
- All hashtags scoped to workspace
- RLS policies enforce access control
- No cross-workspace data leakage

## Constraints Met

✅ **Workspace boundaries**: All hashtags scoped per workspace  
✅ **Simple analytics**: Focus on correctness and data availability  
✅ **Caption parsing**: Automatic extraction on create/update  
✅ **Scheduler consistency**: Hashtags updated when captions change  
✅ **AI integration**: Top hashtags included in generation prompts  

## Follow-up Ideas

### Short-term Enhancements

1. **Post Editor Integration**:
   - Show recommended hashtags in post editor
   - One-click apply to caption
   - Real-time suggestions as user types

2. **Studio Insights UI**:
   - Display "Top Hashtags" list
   - Show engagement trends
   - Click to see posts using hashtag

3. **Hashtag Performance Dashboard**:
   - Charts showing hashtag performance over time
   - Compare hashtag effectiveness
   - Identify trending hashtags

### Medium-term Enhancements

1. **Hashtag Groups**:
   - Group related hashtags (e.g., "fitness", "workout", "gym")
   - Suggest entire groups
   - Track group performance

2. **Competitor Analysis**:
   - Track competitor hashtags
   - Compare performance
   - Suggest similar high-performing tags

3. **Hashtag Trends**:
   - Detect trending hashtags
   - Alert on new opportunities
   - Suggest timely hashtags

### Long-term Vision

1. **Predictive Hashtag Selection**:
   - Predict hashtag performance before posting
   - Optimize hashtag sets for maximum reach
   - A/B test hashtag combinations

2. **Autonomous Hashtag Optimization**:
   - Auto-update hashtags based on performance
   - Learn from user preferences
   - Continuous improvement

3. **Cross-Platform Hashtag Strategy**:
   - Optimize hashtags per platform
   - Track cross-platform performance
   - Unified hashtag strategy

## Testing Recommendations

1. **Unit Tests**:
   - Test `parseHashtags()` with various caption formats
   - Test `upsertPostHashtags()` with edge cases
   - Test engagement rate calculations

2. **Integration Tests**:
   - Test hashtag extraction on post creation
   - Test hashtag update on caption change
   - Test analytics computation
   - Test suggestion endpoint

3. **E2E Tests**:
   - Test full flow: create post → extract hashtags → view insights
   - Test suggestion UI
   - Test backfill process

## Performance Considerations

- Hashtag parsing is lightweight (regex)
- Upsert operations are efficient (single query per hashtag)
- Analytics queries use indexes for fast lookups
- LLM calls are async and don't block UI

## Security Considerations

- RLS policies enforce workspace boundaries
- All queries filtered by workspace_id
- No cross-workspace data access
- Authentication required for all endpoints

## Next Steps

1. **Run backfill**:
   - Process existing posts to extract hashtags
   - Populate initial analytics data

2. **Test UI components**:
   - Verify hashtag suggestions work
   - Test apply functionality

3. **Monitor analytics**:
   - Track hashtag performance
   - Refine suggestion algorithm
   - Collect user feedback

4. **Add more UI integration**:
   - Post editor integration
   - Insights dashboard
   - Analytics charts

