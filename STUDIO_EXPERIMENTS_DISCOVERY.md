# Studio A/B Testing Framework - Discovery

## Overview

This document outlines the discovery phase for implementing an A/B testing framework for Studio posts, integrated with existing metrics, scoring, reports, and agent systems.

## Current State Analysis

### 1. Post & Metrics Schema

**Location**: `supabase/migrations/20250116021000_studio_social_and_analytics.sql` (initial schema)

**Tables**:

- **`studio_social_posts`**:
  - Core post table with fields: `id`, `workspace_id`, `platform`, `caption`, `status`, `scheduled_for`, `published_at`, `predicted_score_label`, `predicted_score_numeric`, etc.
  - Supports time-series metrics via foreign key to `studio_social_post_metrics`
  - Has `repurposed_from_post_id` and `content_group_id` for repurposing

- **`studio_social_post_metrics`**:
  - Time-series metrics table: `social_post_id`, `captured_at`, `impressions`, `views`, `likes`, `comments`, `shares`, `saves`
  - Unique constraint on `(social_post_id, captured_at)` to prevent duplicates
  - Metrics are snapshotted over time (refreshed via cron)

**Query Patterns**:
- Latest metrics: Query with `ORDER BY captured_at DESC LIMIT 1`
- Time-series: Query all metrics for a post ordered by `captured_at`
- Aggregations: Done in `metrics-summary-service.ts` for platform summaries

### 2. Weekly Reports & Metrics Summary

**Location**: `lib/studio/report-service.ts`

**Key Functions**:
- `fetchPeriodMetrics()`: Fetches posts with metrics for a date range
- `calculateDeltas()`: Compares current period vs previous period
- `generateWeeklyReport()`: Main function that calls LLM with metrics context

**Location**: `lib/studio/metrics-summary-service.ts`

**Key Functions**:
- `computeMetricsSummary()`: Aggregates metrics per platform
- Calculates: top posts, avg engagement, best day/time, posting frequency
- Returns `MetricsSummary` with platform breakdowns

**Integration Points**:
- Reports use metrics summary for LLM context
- Planner uses metrics summary for optimal timing suggestions

### 3. Agent Tools & Post Creation

**Location**: `lib/studio/agent-tools.ts`

**Key Functions**:
- `createDraftPost()`: Creates new draft/scheduled posts
- `generateWeeklyPlan()`: Creates multiple draft posts for a week
- `repurposePost()`: Creates repurposed variants

**Patterns**:
- All tools validate workspace ownership
- Posts are created with `workspace_id`, `created_by`
- Tools return structured `ToolResult` with success/error

**Agent Chat**: `app/api/studio/agent/chat/route.ts`
- Uses OpenAI function calling
- Tools defined in `AGENT_TOOLS` array
- System prompt explains available tools

### 4. Existing Variant/Experiment Concepts

**Search Results**: No existing "variant" or "experiment" concepts found.

**Related Concepts**:
- `repurposed_from_post_id`: Links repurposed posts to source
- `content_group_id`: Groups related posts (repurposed variants)
- These are for content repurposing, not A/B testing

**Conclusion**: No existing A/B testing infrastructure. Clean slate.

## Design Decisions

### Experiment Model

**`studio_experiments` table**:
- Groups 2+ posts that test the same hypothesis
- Has `type` field to categorize (caption, hook, time, other)
- Has `status` to track lifecycle (pending → running → completed)

**Post tagging**:
- `experiment_id`: Links post to experiment
- `experiment_variant_label`: 'A', 'B', 'C', etc.
- Allows posts to participate in experiments without breaking existing flows

### Result Computation

**Approach**:
- Simple heuristic: highest engagement rate wins
- Minimum impressions threshold (e.g., 500) to avoid noise
- Can leverage existing `predicted_score_*` fields for correlation

**Metrics used**:
- Engagement rate = (likes + comments + shares + saves) / impressions
- Total impressions
- Total engagement

### Integration Points

1. **Agent**: New `createExperiment` tool
2. **Reports**: Include experiment results in weekly report context
3. **Calendar/Editor**: Show experiment badges (optional v1)
4. **Scoring**: Can use predicted scores to inform experiment setup

## Files to Create/Modify

### New Files
- `supabase/migrations/20250129000000_studio_experiments_schema.sql`
- `lib/studio/experiment-service.ts`
- `app/api/studio/experiments/route.ts`
- `app/api/studio/experiments/[experimentId]/route.ts`
- `app/studio/experiments/page.tsx`
- `STUDIO_EXPERIMENTS_IMPLEMENTATION_SUMMARY.md`

### Modified Files
- `lib/studio/agent-tools.ts` (add `createExperiment` tool)
- `app/api/studio/agent/chat/route.ts` (add tool definition)
- `lib/studio/report-service.ts` (include experiments in report context)
- `app/api/studio/calendar/route.ts` (optional: include experiment_id)
- `app/api/studio/posts/[postId]/route.ts` (optional: include experiment data)

## Constraints

- Backwards compatible: existing posts have `experiment_id = NULL`
- No breaking changes to existing flows
- Experiments are optional enhancement
- Simple winner determination (heuristic, not statistical)

## Next Steps

1. Create schema migration
2. Implement experiment service
3. Create APIs
4. Integrate with agent
5. Integrate with reports
6. Build minimal UI
7. Document implementation

