# Studio A/B Testing Framework - Implementation Summary

## Overview

Implemented a complete A/B testing framework for Studio posts, allowing users to create experiments, compare variants, and automatically determine winners based on engagement metrics.

## What Changed

### 1. Discovery Document

**File**: `STUDIO_EXPERIMENTS_DISCOVERY.md`

Created discovery document outlining:
- Current state of posts and metrics tables
- Metrics summary and report services
- Agent tools patterns
- Design decisions for experiments

### 2. Database Schema

**Migration**: `supabase/migrations/20250129000000_studio_experiments_schema.sql`

**New Table**: `studio_experiments`
- `id`, `workspace_id`, `name`, `type` (caption/hook/time/hashtags/media/other)
- `status` (pending/running/completed/cancelled)
- `description`, `created_at`, `created_by`
- `completed_at`, `winner_variant_label`, `summary_markdown`

**Updated Table**: `studio_social_posts`
- `experiment_id` (FK to `studio_experiments`)
- `experiment_variant_label` (A, B, C, etc.)

**Indexes**:
- `idx_studio_experiments_workspace_id`
- `idx_studio_experiments_status`
- `idx_studio_social_posts_experiment_id`
- `idx_studio_social_posts_experiment_variant` (composite)

**RLS Policies**: Workspace-scoped access control

### 3. Experiment Service

**File**: `lib/studio/experiment-service.ts`

**Core Functions**:

- **`createExperiment()`**:
  - Validates at least 2 posts
  - Ensures posts belong to workspace
  - Checks posts aren't already in experiments
  - Creates experiment record
  - Assigns variant labels (A, B, C...)
  - Updates posts with experiment_id and variant_label

- **`assignVariants()`**:
  - Deterministic assignment based on sorted post IDs
  - Returns map: `postId → variantLabel`

- **`computeExperimentResults()`**:
  - Fetches all posts in experiment
  - Aggregates metrics per variant:
    - Impressions, views, likes, comments, shares, saves
    - Engagement rate = (likes + comments + shares + saves) / impressions
  - Determines winner:
    - Requires minimum 500 impressions
    - Winner = highest engagement rate
    - Must be 10%+ higher than second place (or close margin)
  - Returns `ExperimentResults` with variant metrics and winner

- **`summarizeExperimentResults()`**:
  - LLM-generated summary of experiment
  - Includes what was tested, winner, recommendations
  - 3-4 sentences, actionable

- **`getWorkspaceExperiments()`**: List experiments for workspace
- **`getExperiment()`**: Get single experiment

### 4. API Endpoints

**File**: `app/api/studio/experiments/route.ts`

- **`GET /api/studio/experiments`**:
  - Lists experiments for workspace
  - Optional filters: `status`, `limit`
  - Returns experiments with variant counts

- **`POST /api/studio/experiments`**:
  - Creates new experiment
  - Body: `name`, `type`, `description`, `post_ids[]`
  - Returns experiment + variant mapping

**File**: `app/api/studio/experiments/[experimentId]/route.ts`

- **`GET /api/studio/experiments/[experimentId]`**:
  - Returns experiment details
  - Includes variant posts, computed results, summary

- **`POST /api/studio/experiments/[experimentId]`**:
  - Action: `finalize`
  - Marks experiment as completed
  - Computes final results and generates summary
  - Updates `winner_variant_label` and `summary_markdown`

### 5. Studio Agent Integration

**File**: `lib/studio/agent-tools.ts`

**New Tool**: `createExperiment()`

- Supports two modes:
  1. **Base post + variants**: Creates new variant posts from base
     - `base_post_id` + `variant_specs[]` (caption/hook variations)
     - Clones base post, modifies caption/hook
  2. **Existing posts**: Uses provided post IDs directly
     - `post_ids[]` array

- Validates workspace ownership
- Creates experiment and assigns variants
- Returns experiment ID and variant count

**File**: `app/api/studio/agent/chat/route.ts`

- Added `createExperiment` to `AGENT_TOOLS` array
- Tool definition with parameters
- Updated system prompt to mention experiments
- Added tool execution in switch statement
- Added link to `/studio/experiments` when experiments created

**Example Agent Flows**:
- "Test two hooks for this Instagram post" → Creates experiment with hook variants
- "A/B test this caption" → Creates experiment with caption variants
- "Create an experiment comparing these posts" → Uses existing posts

### 6. Weekly Reports Integration

**File**: `lib/studio/report-service.ts`

**Enhanced `generateWeeklyReport()`**:

- Fetches experiments created in report period
- Computes results for each experiment
- Includes experiment summaries in LLM context:
  - Name, type, variant count
  - Winner (if determined)
  - Engagement rates per variant

- LLM prompt updated to:
  - Include "Experiments" section in context
  - Generate "Experiments" section in markdown output
  - Summarize winners and insights

**Report Output**:
- New section: "Experiments"
- Lists experiments with winners
- Recommendations based on experiment results

### 7. UI Implementation

**File**: `app/studio/experiments/page.tsx`

**Two-Column Layout**:

- **Left**: Experiments list
  - Name, type, status badge
  - Variant count, winner (if any)
  - Created date
  - Click to select

- **Right**: Experiment detail
  - Header with name, type, status
  - "Finalize" button (if running)
  - Results summary card:
    - Total impressions
    - Average engagement rate
    - Winner (if determined)
  - Variants table:
    - Variant label, platform, caption (truncated)
    - Impressions, engagement rate
    - Status
    - Winner highlighted
  - LLM summary (if available)

**Calendar Integration**:

- **File**: `app/api/studio/calendar/route.ts`
  - Includes `experiment_id` and `experiment_variant_label` in response

- **File**: `app/studio/calendar/page.tsx`
  - Shows variant badge (purple pill) on posts in experiments
  - Badge shows variant label (A, B, C, etc.)

### 8. Winner Determination Logic

**Heuristic** (simple, opinionated):

1. **Minimum Threshold**: 500 total impressions across all variants
2. **Winner Selection**:
   - Sort variants by engagement rate (descending)
   - Winner = highest engagement rate
   - Must be 10%+ higher than second place (or close margin)
3. **Edge Cases**:
   - Insufficient data → "Not enough data yet"
   - Tie/close margin → "No clear winner"
   - Only one variant with data → "Need at least 2 variants"

**Future Enhancement**: Statistical significance testing (t-test, chi-square)

## Integration Points

### With Existing Systems

1. **Metrics**: Uses `studio_social_post_metrics` time-series data
2. **Scoring**: Can leverage `predicted_score_*` fields for correlation
3. **Reports**: Experiments appear in weekly reports
4. **Agent**: Can create experiments via natural language
5. **Calendar**: Shows experiment badges on posts

### Backwards Compatibility

- Existing posts have `experiment_id = NULL` (not in experiments)
- No breaking changes to existing flows
- Experiments are optional enhancement
- All existing queries work unchanged

## Files Created

1. `STUDIO_EXPERIMENTS_DISCOVERY.md` - Discovery document
2. `supabase/migrations/20250129000000_studio_experiments_schema.sql` - Database migration
3. `lib/studio/experiment-service.ts` - Core service
4. `app/api/studio/experiments/route.ts` - List/create API
5. `app/api/studio/experiments/[experimentId]/route.ts` - Detail/finalize API
6. `app/studio/experiments/page.tsx` - UI page
7. `STUDIO_EXPERIMENTS_IMPLEMENTATION_SUMMARY.md` - This file

## Files Modified

1. `lib/studio/agent-tools.ts` - Added `createExperiment` tool
2. `app/api/studio/agent/chat/route.ts` - Added tool definition and execution
3. `lib/studio/report-service.ts` - Include experiments in reports
4. `app/api/studio/calendar/route.ts` - Include experiment fields
5. `app/studio/calendar/page.tsx` - Show variant badges

## Usage Examples

### Via API

```typescript
// Create experiment
POST /api/studio/experiments
{
  "name": "Hook Test",
  "type": "hook",
  "post_ids": ["post-1", "post-2"]
}

// Get experiment details
GET /api/studio/experiments/[experimentId]

// Finalize experiment
POST /api/studio/experiments/[experimentId]
{ "action": "finalize" }
```

### Via Agent

```
User: "Take this Instagram draft and create an A/B test with two different hooks"

Agent: Creates experiment with:
- Variant A: Original hook
- Variant B: New hook variation
- Links to calendar and experiments page
```

### Via UI

1. Navigate to `/studio/experiments`
2. View list of experiments
3. Click experiment to see details
4. View variants, metrics, winner
5. Finalize when ready

## Testing Recommendations

1. **Service Tests**:
   - Variant assignment logic
   - Winner determination edge cases
   - Result computation with various metric scenarios

2. **API Tests**:
   - Create experiment with valid/invalid inputs
   - Workspace scoping
   - Finalize flow

3. **Integration Tests**:
   - Agent tool execution
   - Report generation with experiments
   - Calendar badge display

## Future Enhancements

1. **Statistical Significance**:
   - T-test for engagement rates
   - Chi-square for categorical outcomes
   - Confidence intervals

2. **Advanced Experiment Types**:
   - Multi-variant (A/B/C/D)
   - Time-based experiments
   - Media type experiments

3. **Automated Analysis**:
   - Auto-finalize when sufficient data
   - Alert when winner emerges
   - Suggest next experiments

4. **Experiment Templates**:
   - Pre-configured experiment types
   - Best practices guidance
   - Historical experiment library

5. **Visualizations**:
   - Charts comparing variants
   - Trend lines over time
   - Engagement breakdowns

## Notes

- Winner determination is heuristic (not statistical) for v1
- Minimum impressions threshold (500) is configurable
- LLM summaries are optional (can be computed on-demand)
- Experiments are workspace-scoped (consistent with Studio model)
- All existing functionality remains unchanged

