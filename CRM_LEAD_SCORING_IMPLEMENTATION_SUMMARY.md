# CRM + Lead Scoring + AI Follow-Ups + Smart Prioritization + "Today" View Implementation Summary

## Overview

This implementation adds comprehensive CRM capabilities, lead scoring, AI-powered follow-up suggestions, smart email prioritization, and a "Today" dashboard to Sync.

## Database Schema

### New Tables (Migration: `20250125000000_crm_and_lead_scoring_schema.sql`)

1. **`contacts`**
   - Stores contact information extracted from emails
   - Fields: `id`, `user_id`, `email`, `name`, `company`, `role`, `phone`, `first_seen_at`, `last_seen_at`
   - Unique constraint on `(user_id, email)`

2. **`leads`**
   - Sales leads with scoring and stage tracking
   - Fields: `id`, `user_id`, `contact_id`, `business_id`, `lead_score` (0-100), `lead_stage`, `primary_service_id`, `budget`, `timeline`, `last_email_id`, `last_activity_at`, `next_follow_up_at`
   - Stages: `new`, `cold`, `qualified`, `warm`, `negotiating`, `ready_to_close`, `won`, `lost`

3. **`lead_follow_up_suggestions`**
   - AI-generated follow-up suggestions
   - Fields: `id`, `user_id`, `lead_id`, `email_id`, `reason`, `suggested_at`, `suggested_for`, `status` (`pending`, `used`, `dismissed`)

4. **`contact_notes`**
   - Manual notes attached to contacts
   - Fields: `id`, `user_id`, `contact_id`, `body`

5. **`email_queue`** (Extended)
   - Added `priority_score` column (integer, default 0)

6. **`user_sync_preferences`** (Extended)
   - Added `follow_up_threshold_days` (integer, default 5, range 1-30)

## Service Layer

### `lib/sync/crm.ts`
- `upsertContactForEmail()` - Creates or updates contacts from email senders
- `getOrCreateLeadForContact()` - Gets or creates leads for contacts
- `computeLeadScore()` - Deterministic lead scoring algorithm
- `updateLeadFromEmailContext()` - Updates leads with email context and AI extraction
- `getLeadByContactEmail()` - Retrieves lead by contact email

### `lib/sync/extractCrmFields.ts`
- `extractCrmFields()` - AI-powered extraction of CRM fields from emails
- Returns structured data: service interest, budget level, urgency, intent type, etc.
- Uses OpenAI with JSON mode for structured output

### `lib/sync/priority.ts`
- `computeEmailPriority()` - Computes priority scores for emails
- Factors: lead score, category, tasks/reminders, unread status, follow-up suggestions
- `updateEmailPriority()` - Updates priority score in database

### `lib/sync/generateFollowUpDraft.ts`
- `generateFollowUpDraft()` - Generates AI-powered follow-up email drafts
- Uses thread context, lead data, and business context

## Background Jobs

### `lib/sync/jobs/processCrmJob.ts`
- `processCrmBatch()` - Processes emails for CRM extraction and lead scoring
- Integrated into `processEmailIntelligence.ts` pipeline
- Creates/updates contacts and leads automatically

### `lib/sync/jobs/generateFollowUpsJob.ts`
- `generateFollowUpsJob()` - Generates follow-up suggestions for leads
- Finds leads that need follow-ups based on activity threshold
- Skips leads with upcoming appointments

## API Routes

### Extended: `app/api/email-queue/route.ts`
- Added `filter=followups` query parameter
- Added `sort=priority` option
- Enriches emails with CRM data (lead info, follow-up suggestions)

### New: `app/api/sync/jobs/generate-follow-ups/route.ts`
- `POST /api/sync/jobs/generate-follow-ups`
- Triggers follow-up suggestions generation

### New: `app/api/sync/email/[id]/follow-up-draft/route.ts`
- `POST /api/sync/email/[id]/follow-up-draft`
- Generates follow-up draft for an email/lead

## UI Components

### `app/sync/page.tsx` (Updated)
- **Follow-ups Category Chip**: Added to category filter bar
- **Priority Indicators**: Visual dots/chips on email rows (Hot/Warm)
- **CRM Micro-Panel**: Shows lead score, stage, budget, timeline in email detail view
- **Follow-up Button**: Button in email header to generate follow-up drafts
- **Today Tab**: New tab in navigation bar (when enabled)

### `components/sync/TodayDashboard.tsx` (New)
- Displays overdue tasks, tasks due today, upcoming meetings, and pending follow-ups
- Groups items by urgency
- Links to source emails

## Feature Flags

All new features are controlled by feature flags in `lib/sync/featureFlags.ts`:

- `LEAD_SCORING_ENABLED` - Enables CRM extraction and lead scoring
- `FOLLOW_UP_SUGGESTIONS_ENABLED` - Enables follow-up suggestions
- `TODAY_DASHBOARD_ENABLED` - Enables Today dashboard view

## Lead Scoring Algorithm

The scoring algorithm (`computeLeadScore`) uses these factors:

- **Pricing inquiry**: +20 points
- **Appointment request**: +25 points
- **Urgency level**: High (+15), Medium (+8)
- **Budget signal**: High (+15), Medium (+8)
- **Engagement**: 5+ messages (+10), 2+ messages (+5)
- **Service value**: Weighted bonus

**Stage Mapping**:
- Score >= 80: `ready_to_close`
- Score 60-79: `negotiating`
- Score 40-59: `qualified`
- Score 20-39: `warm`
- Score < 20: `new`

## Priority Scoring Algorithm

The priority algorithm (`computeEmailPriority`) uses:

- **Lead score**: 60% of lead score
- **Category weights**: Important/Payments (+15), Marketing (+2)
- **Tasks/Reminders**: Overdue (+30), Due today (+20)
- **Unread**: +10
- **Follow-up suggestion**: +15

## Verification Checklist

### 1. Database Setup
- [ ] Run migration: `supabase/migrations/20250125000000_crm_and_lead_scoring_schema.sql`
- [ ] Verify tables created: `contacts`, `leads`, `lead_follow_up_suggestions`, `contact_notes`
- [ ] Verify `email_queue.priority_score` column exists
- [ ] Verify `user_sync_preferences.follow_up_threshold_days` column exists

### 2. Feature Flags
- [ ] Set `LEAD_SCORING_ENABLED=true` in environment
- [ ] Set `FOLLOW_UP_SUGGESTIONS_ENABLED=true` in environment
- [ ] Set `TODAY_DASHBOARD_ENABLED=true` in environment (optional)

### 3. CRM Processing
- [ ] Trigger intelligence job: `POST /api/sync/jobs/process-intelligence`
- [ ] Check `contacts` table for new contacts from emails
- [ ] Check `leads` table for created/updated leads
- [ ] Verify lead scores are computed correctly

### 4. Follow-Up Suggestions
- [ ] Trigger follow-up job: `POST /api/sync/jobs/generate-follow-ups`
- [ ] Check `lead_follow_up_suggestions` table for pending suggestions
- [ ] Verify suggestions are created for leads past threshold

### 5. UI Verification
- [ ] **Follow-ups Chip**: Appears in category filter bar, shows count badge
- [ ] **Priority Indicators**: Hot/Warm dots appear on email rows with high lead scores
- [ ] **CRM Panel**: Shows in email detail view when lead exists
- [ ] **Follow-up Button**: Appears in email header when suggestion exists, generates draft on click
- [ ] **Today Tab**: Appears in navigation (if enabled), shows tasks/reminders/appointments/follow-ups

### 6. API Verification
- [ ] Email queue API returns enriched data with `lead` and `hasFollowUpSuggestion` fields
- [ ] `filter=followups` parameter filters emails correctly
- [ ] `sort=priority` sorts emails by priority score
- [ ] Follow-up draft API generates drafts correctly

## Testing

### Unit Tests (To Be Added)
- `lib/sync/__tests__/crm.test.ts` - Test contact/lead management
- `lib/sync/__tests__/extractCrmFields.test.ts` - Test AI extraction (mocked)
- `lib/sync/__tests__/priority.test.ts` - Test priority scoring
- `lib/sync/__tests__/generateFollowUpsJob.test.ts` - Test follow-up generation

## Notes

- All existing Sync behavior remains intact
- No breaking changes to existing APIs
- CRM processing is idempotent (re-processing same email updates without duplicates)
- Lead scoring is deterministic and transparent
- Priority scores are computed on-the-fly or stored in `email_queue.priority_score`
- Follow-up suggestions respect user preferences and skip leads with upcoming appointments

## Next Steps

1. Add unit tests for new modules
2. Add integration tests for API routes
3. Add UI tests for new components
4. Consider adding a CRM dashboard/overview page
5. Consider adding manual lead editing UI
6. Consider adding follow-up suggestion management UI


