# Studio Personalization & Learning Loop - Implementation Summary

## Overview

Implemented a learning system that tracks user behavior and adapts AI suggestions accordingly.

## What Changed

### 1. Discovery Document

**File**: `STUDIO_PERSONALIZATION_DISCOVERY.md`

Documented post creation/update/delete points, original content tracking, and signals we can capture.

### 2. Database Schema

**Migration**: `supabase/migrations/20250131000000_studio_personalization_schema.sql`

**New Table**: `studio_ai_feedback_events`

- `id`, `workspace_id`, `post_id`
- `source` (planner, agent, repurpose, manual, unknown)
- `event_type` (accepted, deleted, heavily_edited, lightly_edited)
- `details` (JSONB) - edit_distance, length_change, hashtag_change, etc.
- `created_at`, `created_by`

**Indexes**:
- `idx_studio_ai_feedback_events_workspace_id`
- `idx_studio_ai_feedback_events_post_id`
- `idx_studio_ai_feedback_events_type`
- `idx_studio_ai_feedback_events_workspace_source` (composite)

### 3. Event Capture Helper

**File**: `lib/studio/personalization-event-helper.ts`

**Functions**:

- **`captureFeedbackEvent()`**: Generic event capture
- **`captureEditEvent()`**: Captures edit events with:
  - Edit distance calculation (Levenshtein)
  - Length change percentage
  - Hashtag count changes
  - Determines `heavily_edited` vs `lightly_edited` based on thresholds
- **`captureDeleteEvent()`**: Captures when posts are deleted
- **`captureAcceptanceEvent()`**: Captures when posts are accepted (minimal edits)

**Edit Detection**:
- >50% edit distance → `heavily_edited`
- 10-50% edit distance → `lightly_edited`
- <10% edit distance → `lightly_edited` (minor tweaks)

### 4. Personalization Service

**File**: `lib/studio/personalization-service.ts`

**Core Functions**:

- **`summarizeWorkspacePreferences()`**:
  - Analyzes last 90 days of feedback events
  - Computes:
    - `prefers_short_captions` (if avg length reduction >20%)
    - `prefers_fewer_hashtags` (if avg hashtag change < -1)
    - `prefers_more_hashtags` (if avg hashtag change > 1)
    - `edit_frequency` (high/medium/low based on edit rate)
    - `avg_caption_length_reduction` (percentage)
    - `avg_hashtag_reduction` (count)
  - Returns `WorkspacePreferences` object

- **`formatPreferencesForPrompt()`**: Formats preferences for LLM context

### 5. Integration Points

**Post Updates** (`app/api/studio/posts/[postId]/route.ts`):
- Captures edit events when caption is updated
- Compares old vs new caption
- Non-blocking (errors don't fail the update)

**Planner** (`app/api/studio/plans/weekly/route.ts`):
- Stores `original_caption` in post metadata
- Fetches preferences and includes in LLM prompt
- LLM adapts suggestions to user preferences

**Repurposer** (`lib/studio/repurposing-service.ts`):
- Includes preferences in repurposing prompt
- Adapts repurposed content to match user style

**Scoring** (`lib/studio/scoring-service.ts`):
- Adjusts optimal caption length based on preferences
- Adjusts optimal hashtag count based on preferences
- Rewards alignment with user preferences

**Agent** (`app/api/studio/agent/chat/route.ts`):
- Fetches preferences and includes in system prompt
- Agent adapts suggestions to learned preferences

### 6. Optional UI

Not implemented in v1 (can be added to settings later).

## Files Created

1. `STUDIO_PERSONALIZATION_DISCOVERY.md`
2. `supabase/migrations/20250131000000_studio_personalization_schema.sql`
3. `lib/studio/personalization-event-helper.ts`
4. `lib/studio/personalization-service.ts`
5. `STUDIO_PERSONALIZATION_IMPLEMENTATION_SUMMARY.md` (this file)

## Files Modified

1. `app/api/studio/posts/[postId]/route.ts` - Capture edit events
2. `app/api/studio/plans/weekly/route.ts` - Store original captions, include preferences
3. `lib/studio/repurposing-service.ts` - Include preferences
4. `lib/studio/scoring-service.ts` - Factor in preferences
5. `app/api/studio/agent/chat/route.ts` - Include preferences in prompt

## Notes

- **Non-Intrusive**: Event capture doesn't block operations
- **Backwards Compatible**: Existing posts won't have original captions (graceful handling)
- **Simple Heuristics**: v1 uses basic thresholds, not complex ML
- **Privacy**: All data workspace-scoped

## Future Enhancements

1. **Tone Analysis**: LLM-based tone shift detection
2. **Content Theme Learning**: Learn preferred content themes/topics
3. **Timing Preferences**: Learn preferred posting times
4. **Preferences UI**: Show learned preferences in settings
5. **Explicit Feedback**: Allow users to rate AI suggestions

