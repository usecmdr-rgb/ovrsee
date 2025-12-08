# Studio Multi-Week Campaign Planning - Discovery

## Overview

This document outlines the approach for implementing campaign-based planning in Studio.

## Current State Analysis

### 1. Post Creation & Planning

**Planner**:
- `app/api/studio/plans/weekly/route.ts`
- Creates posts with `scheduled_for` dates
- Posts stored in `studio_social_posts`

**Calendar**:
- `app/studio/calendar/page.tsx`
- Displays posts by date
- Supports drag-and-drop rescheduling

### 2. Reports & Metrics

**Reports**:
- `lib/studio/report-service.ts`
- `generateWeeklyReport()` filters by date range
- Can be extended to filter by campaign

**Metrics Summary**:
- `lib/studio/metrics-summary-service.ts`
- `computeMetricsSummary()` accepts optional `periodStart` and `periodEnd`
- Can filter posts by date range

## Design Decisions

### Campaign Model

**`studio_campaigns` table**:
- Groups posts over a date range
- Has objective (launch, awareness, promo, etc.)
- Links to workspace

**Post linkage**:
- `campaign_id` on `studio_social_posts`
- Posts can belong to one campaign (or none)

### Planner Integration

**Option A (v1, minimal)**:
- Add optional `campaign_id` to weekly planner
- If provided, set `campaign_id` on created posts
- Validate `scheduled_for` falls within campaign dates

**Option B (future)**:
- Dedicated campaign planner endpoint
- Plans across entire campaign period
- More sophisticated distribution

For v1, we'll do Option A.

### Reports Integration

- Add `campaign_id` query param to reports
- Filter posts by campaign date range
- Generate campaign-specific reports

## Files to Create/Modify

### New Files
- `supabase/migrations/20250201000000_studio_campaigns_schema.sql`
- `app/api/studio/campaigns/route.ts`
- `app/api/studio/campaigns/[id]/route.ts`
- `app/studio/campaigns/page.tsx`
- `STUDIO_CAMPAIGNS_IMPLEMENTATION_SUMMARY.md`

### Modified Files
- `app/api/studio/plans/weekly/route.ts` (accept campaign_id)
- `lib/studio/report-service.ts` (campaign filtering)
- `app/api/studio/calendar/route.ts` (optional: filter by campaign)
- `app/studio/calendar/page.tsx` (optional: campaign filter UI)

## Constraints

- Backwards compatible: existing posts have `campaign_id = NULL`
- Campaigns are optional enhancement
- Date validation: posts must fall within campaign dates

## Next Steps

1. Create schema migration
2. Create campaign APIs
3. Integrate with planner
4. Integrate with reports
5. Build UI
6. Document implementation

