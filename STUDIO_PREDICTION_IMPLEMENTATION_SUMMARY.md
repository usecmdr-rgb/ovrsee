# Studio Performance Prediction & Draft Scoring - Implementation Summary

## Overview

Implemented performance prediction and draft scoring system that scores draft posts with expected performance labels (`low`, `medium`, `high`) and provides explanatory reasoning.

## What Changed

### 1. Discovery Document

**File**: `STUDIO_PREDICTION_DISCOVERY.md`

Created comprehensive discovery document outlining:
- Available data sources (posts, metrics, hashtags, brand profile)
- Derivable features for scoring
- Heuristic scoring approach
- LLM explanation strategy
- Integration points

### 2. Scoring Service

**File**: `lib/studio/scoring-service.ts`

Created service with core functions:

- **`extractDraftFeatures(postId)`**:
  - Extracts features from draft post:
    - Platform, caption length, hashtag count
    - Scheduled time (day of week, hour)
    - Repurposed lineage
    - Media type, emoji count
  - Returns `DraftFeatures` object

- **`scoreDraft(workspaceId, features)`**:
  - Heuristic scoring function:
    - Base score: 0.5 (medium)
    - **Timing Alignment** (+0.15):
      - Scheduled at historically best day/time
      - Penalty if scheduled at worst times
    - **Hashtag Performance** (+0.1 / -0.1):
      - Reward using 3+ top-performing hashtags
      - Penalty if no top hashtags used
    - **Content Characteristics** (+0.1 / -0.1):
      - Optimal caption length per platform
      - Optimal hashtag count per platform
    - **Lineage Boost** (+0.2):
      - If repurposed from high-performing post (>3% engagement)
  - Returns `ScoreResult` with label and numeric score

- **`explainDraftScore(workspaceId, postId, features, score)`**:
  - Generates LLM explanation using:
    - Brand profile context
    - Historical performance data
    - Extracted features
    - Reasoning factors
  - Returns 2-3 sentence actionable explanation

- **`scoreDraftPost(workspaceId, postId, options)`**:
  - Main entry point:
    - Extracts features
    - Scores draft
    - Optionally generates explanation
    - Updates post with scores
  - Returns score and explanation

### 3. Database Schema

**Migration**: `supabase/migrations/20250128000000_studio_scoring_schema.sql`

Added to `studio_social_posts`:
- `predicted_score_label` TEXT (low, medium, high)
- `predicted_score_numeric` FLOAT (0.0 to 1.0)
- `predicted_score_explanation` TEXT
- `predicted_score_updated_at` TIMESTAMPTZ

**Indexes**:
- `idx_studio_social_posts_score_label` - Filter by score label
- `idx_studio_social_posts_score_numeric` - Sort by score

### 4. Integration Points

#### Weekly Planner
**File**: `app/api/studio/plans/weekly/route.ts`

- After creating each draft post, automatically scores it
- Scoring is async (doesn't block post creation)
- Errors are logged but don't fail the operation

#### Agent Tools
**File**: `lib/studio/agent-tools.ts`

- `createDraftPost`: Scores post after creation
- `generateWeeklyPlan`: Scores all created posts
- Agent can mention high-scoring drafts in responses

#### Calendar API
**File**: `app/api/studio/calendar/route.ts`

- Includes `predicted_score_label` and `predicted_score_numeric` in response
- Calendar UI can display score indicators

#### Post Detail API
**File**: `app/api/studio/posts/[postId]/route.ts`

- Includes scoring data in post detail response
- Editor UI can display score and explanation

#### Manual Scoring Endpoint
**File**: `app/api/studio/posts/[postId]/score/route.ts`

- `POST /api/studio/posts/[postId]/score`
- Allows manual trigger of scoring
- Optional `generateExplanation` parameter

### 5. UI Integration

#### Calendar View
**File**: `app/studio/calendar/page.tsx`

- Added score indicator dot next to post caption
- Color-coded:
  - Green: High score
  - Yellow: Medium score
  - Red: Low score
- Tooltip shows "Predicted performance: [label]"

#### Editor (Future)
- Score can be displayed in post detail view
- Explanation can be shown in expandable section
- "Improve Score" suggestions (future enhancement)

## Feature Set Used

### Timing Features
- Scheduled day of week vs. historically best day
- Scheduled hour vs. historically best time window
- Alignment score based on metrics summary

### Hashtag Features
- Count of top-performing hashtags used
- Percentage of hashtags that are top performers
- Optimal hashtag count per platform

### Content Features
- Caption length vs. optimal range per platform
- Hashtag count vs. optimal range per platform
- Emoji count (extracted but not heavily weighted)

### Lineage Features
- If repurposed from high-performing post
- Source post engagement rate
- Content group performance

## Heuristic Logic

### Score Calculation

1. **Base Score**: 0.5 (medium)

2. **Timing Alignment**:
   - +0.15 if scheduled at best day + time window
   - -0.1 if scheduled at worst times

3. **Hashtag Performance**:
   - +0.1 if 3+ top-performing hashtags used
   - -0.1 if no top hashtags used

4. **Content Characteristics**:
   - +0.1 if caption length optimal
   - +0.1 if hashtag count optimal
   - -0.1 if caption too short/long
   - -0.1 if hashtag count outside range

5. **Lineage Boost**:
   - +0.2 if repurposed from post with >3% engagement

6. **Final Mapping**:
   - < 0.4 → `low`
   - 0.4 - 0.7 → `medium`
   - >= 0.7 → `high`

### Platform-Specific Optimal Ranges

**Instagram**:
- Caption: 100-300 chars
- Hashtags: 5-10

**TikTok**:
- Caption: 50-200 chars
- Hashtags: 3-5

**Facebook**:
- Caption: 100-500 chars
- Hashtags: 3-8

## LLM Explanation

### Context Provided
- Brand profile (target audience, voice, tone)
- Draft post details (caption, platform, scheduled time)
- Performance factors (timing, hashtags, content, lineage)
- Historical context (best times, average engagement)

### Prompt Structure
- System: "You are a social media performance analyst..."
- User: Structured prompt with all context
- Response: 2-3 sentences, actionable, specific

### Usage
- Explanation generated on-demand (not for batch scoring)
- Can be triggered via API endpoint
- Stored in `predicted_score_explanation` field

## Performance Considerations

- Scoring is fast (<500ms per post)
- Historical data cached via metrics summary service
- Batch scoring is async (doesn't block post creation)
- LLM explanation is lazy-loaded (only when requested)

## Error Handling

- Scoring errors are logged but don't fail operations
- Missing data (no metrics, no hashtags) handled gracefully
- Defaults to medium score if insufficient data

## Future Enhancements

1. **Machine Learning Model**:
   - Replace heuristic with trained model
   - Use historical post performance as training data

2. **Multi-Factor Scoring**:
   - Separate scores for engagement, reach, saves
   - Weighted combination

3. **Confidence Intervals**:
   - Provide confidence level for predictions
   - Show uncertainty in UI

4. **Real-Time Updates**:
   - Re-score as metrics change
   - Update predictions based on actual performance

5. **A/B Test Integration**:
   - Score variants differently
   - Compare predicted vs. actual

6. **Improvement Suggestions**:
   - "Improve Score" feature
   - Specific recommendations (e.g., "Add 2 more hashtags")

## Files Created

1. `STUDIO_PREDICTION_DISCOVERY.md` - Discovery document
2. `lib/studio/scoring-service.ts` - Scoring service
3. `supabase/migrations/20250128000000_studio_scoring_schema.sql` - Database migration
4. `app/api/studio/posts/[postId]/score/route.ts` - Manual scoring endpoint
5. `STUDIO_PREDICTION_IMPLEMENTATION_SUMMARY.md` - This file

## Files Modified

1. `app/api/studio/plans/weekly/route.ts` - Auto-score planner posts
2. `lib/studio/agent-tools.ts` - Score agent-created posts
3. `app/api/studio/calendar/route.ts` - Include scores in calendar response
4. `app/api/studio/posts/[postId]/route.ts` - Include scores in post detail
5. `app/studio/calendar/page.tsx` - Display score indicators

## Testing Recommendations

1. **Unit Tests**:
   - Test `extractDraftFeatures` with various post configurations
   - Test `scoreDraft` with different feature combinations
   - Test score mapping (low/medium/high thresholds)

2. **Integration Tests**:
   - Test scoring in planner flow
   - Test scoring in agent tools
   - Test explanation generation

3. **E2E Tests**:
   - Test score display in calendar
   - Test manual scoring endpoint
   - Test score updates after post edits

## Usage Examples

### Automatic Scoring (Planner)
```typescript
// Weekly planner automatically scores posts after creation
const plan = await generateWeeklyPlan(workspaceId, userId, {});
// Posts are scored async, scores available in post.predicted_score_label
```

### Manual Scoring
```typescript
// Score a specific post
const result = await scoreDraftPost(workspaceId, postId, {
  generateExplanation: true
});
// result.score.label = "high" | "medium" | "low"
// result.explanation = "This post is predicted to perform well because..."
```

### API Endpoint
```bash
POST /api/studio/posts/[postId]/score
{
  "generateExplanation": true
}
```

## Notes

- Scoring is optional and non-blocking
- Scores are computed asynchronously to avoid slowing down post creation
- Explanation generation is expensive (LLM call), so it's on-demand only
- Scores can be recomputed if post is edited (future: auto-recompute on edit)

