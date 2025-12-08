# Studio Autonomous Weekly Planner Implementation Summary

## Overview

Implemented an autonomous weekly content planner that analyzes recent social media performance and brand profile to automatically generate a weekly posting plan with draft posts scheduled across the week.

## Discovery Summary

### Existing Pieces

1. **Metrics Storage**:
   - Table: `studio_social_post_metrics` (time-series with `captured_at`)
   - Query pattern: Join `studio_social_posts` with `studio_social_post_metrics`, filter by `posted_at >= thresholdDate`, get latest metrics per post
   - Existing helpers: `app/api/studio/social/summary/route.ts`, `app/api/studio/analytics/posts/route.ts`

2. **Brand Profile**:
   - Service: `lib/studio/brand-profile-service.ts`
   - Functions: `getBrandProfile()`, `formatBrandProfileForPrompt()`
   - Returns formatted brand identity (description, audience, voice, tone, attributes)

3. **Studio Agent Prompts**:
   - Pattern: `app/api/studio/ask/route.ts`
   - Uses OpenAI with `response_format: { type: "json_object" }`
   - Model: `AGENT_CONFIG.studio.primaryModel` (gpt-4o)
   - Includes brand profile and performance data in prompts

## What Changed

### 1. Metrics Summary Helper Service

**File**: `lib/studio/metrics-summary-service.ts`

Created service that computes performance summaries:

- **`computeMetricsSummary()`**:
  - Fetches posts with metrics from last 30-90 days (configurable)
  - Calculates engagement rates per post: `(likes + comments + shares + saves) / impressions` (or views for TikTok)
  - Groups by platform and computes:
    - Total posts, average engagement rate
    - Average likes, comments, impressions, views
    - Posting frequency (posts per week)
    - Top 10 posts by engagement
    - Best day of week (highest avg engagement)
    - Best time window (highest avg engagement by hour ranges: 0-9, 9-12, 12-15, 15-18, 18-21, 21-24)
  - Returns compact JSON summary suitable for LLM input

**Features**:
- Handles missing metrics gracefully
- Calculates platform-specific engagement (views for TikTok, impressions for Instagram)
- Analyzes temporal patterns (day of week, time windows)
- Returns structured data for LLM consumption

### 2. Weekly Plan Schema

**File**: `lib/studio/weekly-plan-types.ts`

Defined TypeScript types:

- **`ProposedPost`**:
  - `platforms`: Array of platforms (can be multi-platform)
  - `suggested_datetime`: ISO timestamp
  - `idea_title`: Content idea name
  - `content_brief`: Description of content
  - `caption`: Optional starting caption/hook
  - `suggested_media_type`: image, video, carousel
  - `hashtags`: Optional hashtag suggestions

- **`WeeklyPlan`**:
  - `week_start`, `week_end`: ISO dates
  - `proposed_posts`: Array of ProposedPost
  - `plan_rationale`: Optional explanation
  - `total_posts`: Count
  - `posts_by_platform`: Breakdown by platform

- **`PlanPreferences`**:
  - `desired_cadence`: Posts per week per platform
  - `preferred_days`: Array of day names
  - `preferred_times`: Array of time windows
  - `content_themes`: Optional themes
  - `avoid_topics`: Topics to avoid

### 3. Planner Endpoint

**File**: `app/api/studio/plans/weekly/route.ts`

Created `POST /api/studio/plans/weekly` endpoint that:

1. **Resolves workspace and inputs**:
   - Gets workspace ID from authenticated user
   - Fetches brand profile
   - Computes metrics summary (last 60 days)
   - Gets connected social accounts

2. **Week determination**:
   - Accepts optional `week_start` (defaults to next Monday)
   - Calculates week end (Sunday)
   - Checks for existing posts (if `avoid_duplicates = true`)

3. **LLM prompt construction**:
   - System prompt: Defines role as content strategist
   - User prompt includes:
     - Brand profile (formatted)
     - Metrics summary (JSON)
     - Available platforms
     - User preferences (if provided)
     - Week range
     - Requirements (5-15 posts, distribute across platforms, use best times, etc.)

4. **LLM call**:
   - Uses `gpt-4o` model
   - `response_format: { type: "json_object" }`
   - Temperature: 0.8 (creative content ideas)

5. **Post creation**:
   - Parses LLM response into `WeeklyPlan`
   - Validates structure
   - Creates `studio_social_posts` records with:
     - `status = 'draft'`
     - `scheduled_for = suggested_datetime`
     - `caption` from proposed post
     - `metadata` with idea_title, content_brief, hashtags, etc.
     - Links to appropriate social account

6. **Response**:
   - Returns plan with created post IDs
   - Includes any errors encountered during creation

**Idempotency**:
- Checks for existing posts in week range
- Returns error if posts exist and `avoid_duplicates = true`
- Can be called multiple times for different weeks

### 4. UI Trigger

**File**: `app/studio/calendar/page.tsx` (modified)

Added "Generate Weekly Plan" button:

- **Location**: Calendar header, next to month navigation
- **Functionality**:
  - Calculates next Monday as default week start
  - Calls planner endpoint
  - Shows loading state during generation
  - Reloads calendar to show new drafts
  - Focuses calendar on planned week
  - Shows success message with count of created posts

**User Flow**:
1. User clicks "Generate Weekly Plan"
2. System generates plan for next week
3. Draft posts appear in calendar
4. User can edit, schedule, or publish drafts

## Files Created

1. `lib/studio/metrics-summary-service.ts` - Metrics summary computation
2. `lib/studio/weekly-plan-types.ts` - TypeScript types for weekly plans
3. `app/api/studio/plans/weekly/route.ts` - Planner endpoint
4. `STUDIO_WEEKLY_PLANNER_DISCOVERY.md` - Discovery document
5. `STUDIO_WEEKLY_PLANNER_IMPLEMENTATION_SUMMARY.md` - This file

## Files Modified

1. `app/studio/calendar/page.tsx` - Added "Generate Weekly Plan" button

## LLM Prompt Shape

### System Prompt
```
You are a social media content strategist and planner. Your job is to create a weekly content plan that:
1. Aligns with the brand's identity and voice
2. Learns from past performance data
3. Optimizes for engagement based on historical patterns
4. Provides variety in content types and themes
5. Schedules posts at optimal times based on performance data
```

### User Prompt Structure
```
Create a weekly content plan for the week of [week_start] to [week_end].

Brand Profile:
[formatted brand profile text]

Performance Summary (Last 60 days):
[JSON metrics summary with platforms, engagement rates, best times, top posts]

Available Platforms: [instagram, tiktok, facebook]

User Preferences:
[JSON preferences if provided]

Requirements:
- Generate 5-15 posts for the week
- Distribute posts across available platforms
- Use best posting times from performance data
- Vary content types
- Align with brand voice
- Include engaging captions
```

### Response Schema
```json
{
  "week_start": "2024-01-15",
  "week_end": "2024-01-21",
  "proposed_posts": [
    {
      "platforms": ["instagram"],
      "suggested_datetime": "2024-01-15T10:00:00Z",
      "idea_title": "Monday Motivation Post",
      "content_brief": "Inspirational quote with brand colors",
      "caption": "Start your week strong! 💪",
      "suggested_media_type": "image",
      "hashtags": ["#motivation"]
    }
  ],
  "plan_rationale": "Strategy explanation",
  "total_posts": 7,
  "posts_by_platform": {
    "instagram": 5,
    "tiktok": 2
  }
}
```

## API Endpoints

### POST /api/studio/plans/weekly

**Request Body**:
```json
{
  "week_start": "2024-01-15T00:00:00Z", // Optional, defaults to next Monday
  "preferences": { // Optional
    "desired_cadence": {
      "instagram": 5,
      "tiktok": 3
    },
    "preferred_days": ["Monday", "Wednesday", "Friday"],
    "preferred_times": ["9-12", "15-18"]
  },
  "avoid_duplicates": true // Default: true
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "week_start": "2024-01-15",
    "week_end": "2024-01-21",
    "proposed_posts": [...],
    "plan_rationale": "...",
    "total_posts": 7,
    "posts_by_platform": {...},
    "created_post_ids": ["uuid1", "uuid2", ...],
    "errors": [] // If any
  }
}
```

## New Helpers & Services

### Metrics Summary Service

**Functions**:
- `computeMetricsSummary(workspaceId, windowDays, supabaseClient?)`:
  - Returns `MetricsSummary` with platform breakdowns
  - Calculates engagement rates, averages, best times
  - Identifies top performing posts

**Output Format**:
```typescript
{
  period_days: 60,
  platforms: [
    {
      platform: "instagram",
      total_posts: 25,
      avg_engagement_rate: 3.5,
      avg_likes: 150,
      posting_frequency: 2.9, // posts per week
      top_posts: [...],
      best_day_of_week: { day: "Wednesday", avg_engagement: 4.2 },
      best_time_window: { hour_range: "9-12", avg_engagement: 4.5 }
    }
  ],
  overall_avg_engagement: 3.2,
  total_posts: 45
}
```

## Follow-up Ideas

### Short-term Enhancements

1. **Plan Preview & Editing**:
   - Show generated plan in modal before creating posts
   - Allow user to edit/remove posts before creation
   - Add/remove posts from plan

2. **Plan Variations**:
   - Generate multiple plan options
   - Let user choose preferred plan
   - A/B test different strategies

3. **Content Themes**:
   - Allow user to specify content themes for the week
   - Generate posts around specific topics/events
   - Seasonal/holiday content planning

4. **Multi-platform Posts**:
   - Support creating same post for multiple platforms
   - Platform-specific caption variations
   - Cross-platform scheduling

### Medium-term Enhancements

1. **Learning from User Edits**:
   - Track which generated posts users keep vs. delete
   - Learn preferred content types
   - Refine future plan generation

2. **Content Repurposing**:
   - Suggest repurposing top-performing posts
   - Adapt content for different platforms
   - Reuse successful formats

3. **Trend Integration**:
   - Incorporate trending topics/hashtags
   - Suggest timely content based on events
   - Seasonal content suggestions

4. **Collaborative Planning**:
   - Allow team members to review/approve plans
   - Comments/feedback on proposed posts
   - Approval workflow

### Long-term Vision

1. **Predictive Planning**:
   - Predict post performance before scheduling
   - Optimize plan for maximum engagement
   - Suggest content based on predicted outcomes

2. **Autonomous Execution**:
   - Auto-generate media for posts
   - Auto-publish approved drafts
   - Fully autonomous content pipeline

3. **Advanced Analytics**:
   - Compare planned vs. actual performance
   - Learn optimal posting patterns
   - Continuous plan optimization

4. **Content Library Integration**:
   - Suggest using existing assets
   - Generate plans around available media
   - Reuse high-performing content

5. **Multi-week Planning**:
   - Monthly/quarterly content calendars
   - Long-term content strategy
   - Campaign-based planning

## Error Handling & Edge Cases

### Missing Brand Profile
- Falls back to generic best practices
- Prompts user to set up brand profile
- Still generates plan but with generic guidance

### Sparse Metrics
- Handles workspaces with few/no posts
- Uses industry benchmarks as fallback
- Provides generic posting schedule

### No Connected Accounts
- Returns clear error message
- Guides user to connect accounts first

### Duplicate Prevention
- Checks for existing posts in week range
- Prevents duplicate plan generation
- Can be disabled with `avoid_duplicates: false`

### LLM Failures
- Catches JSON parsing errors
- Validates response structure
- Returns helpful error messages

## Testing Recommendations

1. **Unit Tests**:
   - Test `computeMetricsSummary()` with various data
   - Test engagement rate calculations
   - Test best time/day analysis

2. **Integration Tests**:
   - Test full planner flow
   - Test with/without brand profile
   - Test with sparse metrics

3. **E2E Tests**:
   - Test UI button click flow
   - Test plan generation and post creation
   - Test calendar display of generated drafts

## Performance Considerations

- Metrics summary computation is efficient (single query with joins)
- LLM call is async and doesn't block
- Post creation is batched but sequential (could be parallelized)
- Calendar reload after generation is fast

## Security Considerations

- Requires authentication
- Workspace-scoped (RLS enforced)
- Validates user owns workspace
- No sensitive data in prompts

## Next Steps

1. **Test the implementation**:
   - Generate plans for test workspaces
   - Verify posts are created correctly
   - Check calendar display

2. **Monitor LLM responses**:
   - Track plan quality
   - Monitor for parsing errors
   - Collect user feedback

3. **Iterate on prompts**:
   - Refine based on generated plans
   - Improve content quality
   - Better time optimization

4. **Add preview/editing**:
   - Show plan before creating posts
   - Allow user modifications
   - Improve UX

