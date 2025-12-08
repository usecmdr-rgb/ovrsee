# Studio Personalization & Learning Loop - Discovery

## Overview

This document outlines the approach for implementing a learning system that tracks user behavior and adapts AI suggestions accordingly.

## Current State Analysis

### 1. Post Creation/Update/Delete Points

**Planner**:
- `app/api/studio/plans/weekly/route.ts`
- Creates posts via `studio_social_posts.insert()`
- Posts have `metadata.generated_by = "weekly_planner"`

**Agent Tools**:
- `lib/studio/agent-tools.ts`
- `createDraftPost()` - Creates posts with `metadata.created_by = userId`
- `generateWeeklyPlan()` - Creates posts with `metadata.generated_by = "weekly_planner"`

**Repurposing**:
- `app/api/studio/repurpose/route.ts`
- Creates posts with `metadata.repurposed_from = source_post_id`
- Posts have `repurposed_from_post_id` field

**Manual**:
- `app/api/studio/posts/route.ts` (POST)
- Direct post creation via API

**Update**:
- `app/api/studio/posts/[postId]/route.ts` (PATCH)
- Updates caption, scheduled_for, status

**Delete**:
- Need to check if delete endpoint exists
- If not, we'll need to add one or hook into existing deletion flow

### 2. Original AI-Generated Content

**Current State**:
- Posts created by planner/agent/repurpose have:
  - `metadata.generated_by` field
  - Original caption stored in `caption` field
  - No separate "original" vs "edited" tracking

**Approach**:
- When AI creates a post, store original caption in `metadata.original_caption`
- When user edits, compare `caption` vs `metadata.original_caption`
- Calculate edit distance to determine edit intensity

### 3. Signals We Can Capture

**Deletion**:
- When post is deleted → `event_type = 'deleted'`
- Source from `metadata.generated_by` or post creation context

**Editing**:
- When `caption` is updated → compare old vs new
- Edit distance heuristics:
  - Levenshtein distance or character diff percentage
  - If > 50% changed → `heavily_edited`
  - If < 50% changed → `lightly_edited`
  - If < 10% changed → might be `accepted` (minor tweaks)

**Acceptance**:
- If post is published without significant edits → `accepted`
- Or if user explicitly approves (future: explicit approval action)

**Content Analysis**:
- Caption length changes
- Hashtag count changes
- Tone shifts (via simple heuristics or LLM classification)

## Design Decisions

### Feedback Events Model

**`studio_ai_feedback_events` table**:
- Links to post via `post_id`
- `source`: Where the post came from (planner, agent, repurpose, manual)
- `event_type`: What happened (accepted, deleted, heavily_edited, lightly_edited)
- `details` (JSONB): Additional context (edit_distance, length_change, etc.)

### Preference Inference

**High-Level Preferences**:
- `prefers_short_captions`: User tends to shorten AI-generated captions
- `prefers_fewer_hashtags`: User removes hashtags from suggestions
- `tone_shift`: User makes content more casual/formal
- `prefers_direct_hooks`: User edits hooks to be more direct
- `prefers_longer_content`: User expands on AI suggestions

**Inference Logic**:
- Aggregate events per workspace
- Calculate averages:
  - Average caption length reduction/increase
  - Average hashtag count change
  - Common edit patterns
- Use thresholds to determine preferences

### Integration Points

1. **Planner**: Include preferences in LLM prompt
2. **Repurposer**: Adapt repurposed content to preferences
3. **Scoring**: Boost scores for posts aligned with preferences
4. **Agent**: Mention preferences in system prompt, adapt suggestions

## Files to Create/Modify

### New Files
- `supabase/migrations/20250131000000_studio_personalization_schema.sql`
- `lib/studio/personalization-service.ts`
- `lib/studio/personalization-event-helper.ts`
- `STUDIO_PERSONALIZATION_IMPLEMENTATION_SUMMARY.md`

### Modified Files
- `app/api/studio/posts/[postId]/route.ts` (capture edit events)
- `app/api/studio/posts/route.ts` (capture delete events if delete exists)
- `app/api/studio/plans/weekly/route.ts` (store original captions, include preferences)
- `lib/studio/repurposing-service.ts` (include preferences)
- `lib/studio/scoring-service.ts` (factor in preferences)
- `app/api/studio/agent/chat/route.ts` (mention preferences)
- `app/studio/settings/page.tsx` (optional: show preferences UI)

## Constraints

- Backwards compatible: existing posts won't have original captions
- Non-intrusive: event capture shouldn't slow down operations
- Simple v1: basic heuristics, not complex ML
- Privacy: all data workspace-scoped

## Next Steps

1. Create schema migration
2. Implement event capture helper
3. Hook into post update/delete flows
4. Create personalization service
5. Integrate into planner, repurposer, scoring, agent
6. Optional: Add preferences UI
7. Document implementation

