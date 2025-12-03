# Data Retention Implementation Summary

This document explains how the data retention system works with the 3-day trial, subscription management, and one-trial-per-email rule.

## Overview

The data retention system provides grace periods for users to reactivate before their interaction data (conversations, messages) is permanently deleted. This preserves user identity, agent configurations, and subscription history while cleaning up accumulated interaction data.

## How It Works Together

### 1. **3-Day Free Trial**

- New users automatically get a 3-day free trial (`tier = 'trial'`, `status = 'active'`)
- Trial starts when user signs up (triggered by `handle_new_user()` function)
- Trial ends 3 days after signup (`trial_ends_at = NOW() + 3 days`)

**When trial expires:**
- `tier` changes to `'trial_expired'`
- `status` changes to `'expired'`
- `trial_ended_at` is set to current timestamp
- **30-day retention window begins**: `data_retention_expires_at = NOW() + 30 days`
- `data_retention_reason = 'trial_expired'`

### 2. **30-Day Retention for Trial Users**

After trial expiration:
- User cannot fully use the app (no active access)
- All interaction data is preserved for 30 days
- User can upgrade at any time during these 30 days
- If user upgrades: retention window is cleared, all data preserved
- If 30 days pass without upgrade: interaction data is deleted (see cleanup job)

### 3. **60-Day Retention for Canceled/Paused Paid Users**

When a paid user cancels or pauses:
- Subscription status changes to `'canceled'` or `'paused'`
- `paid_canceled_at` is set to current timestamp
- **60-day retention window begins**: `data_retention_expires_at = NOW() + 60 days`
- `data_retention_reason = 'paid_canceled'` or `'paid_paused'`

During retention window:
- User may have limited/read-only access (depending on implementation)
- All interaction data is preserved
- User can reactivate at any time
- If user reactivates: retention window is cleared, all data preserved
- If 60 days pass without reactivation: interaction data is deleted

### 4. **One-Trial-Per-Email Rule**

- `has_used_trial` flag in `profiles` table tracks if email has used a trial
- Flag is set to `true` when trial starts
- **Flag is NEVER reset**, even when:
  - Data is cleared
  - User cancels subscription
  - User account is deleted (soft delete preserves flag)
- Email normalization prevents case/whitespace variations from bypassing the rule

## Data Model: What Gets Deleted vs. What's Preserved

### **PRESERVED (Never Deleted):**
- `auth.users` - User authentication record
- `profiles` - User profile data
- `subscriptions` - Subscription history and metadata
- `has_used_trial` - Trial usage flag (prevents new trials)
- `trial_started_at`, `trial_ended_at` - Trial history
- `agents` - Agent definitions/configurations (these are user's "tools", not interaction data)
- Billing history and audit logs

### **DELETED (After Retention Expires):**
- `agent_conversations` - All user conversations
- `agent_messages` - All messages in conversations
- Any other interaction/memory tables (agent logs, event history, etc.)

**Key Point:** Agent definitions (`agents` table) are preserved because they represent user configuration, not interaction history.

## Scheduled Cleanup Job

### Implementation

The cleanup job is implemented as a Next.js API route:
- **Route:** `/api/admin/data-retention-cleanup`
- **Method:** POST (for running cleanup), GET (for status check)
- **Security:** Protected by optional `DATA_RETENTION_CLEANUP_SECRET` environment variable

### How to Schedule

**Option 1: Supabase Cron (Recommended)**
```sql
-- In Supabase SQL Editor, create a cron job:
SELECT cron.schedule(
  'data-retention-cleanup',
  '0 2 * * *', -- Run daily at 2 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://yourdomain.com/api/admin/data-retention-cleanup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.data_retention_secret', true),
      'Content-Type', 'application/json'
    )
  ) AS request_id;
  $$
);
```

**Option 2: Cloudflare Cron (if using Workers)**
Add to `wrangler.toml`:
```toml
[triggers]
crons = ["0 2 * * *"]  # Daily at 2 AM UTC
```

**Option 3: External Cron Service**
Use a service like cron-job.org or GitHub Actions to call:
```
POST https://yourdomain.com/api/admin/data-retention-cleanup
Authorization: Bearer YOUR_SECRET
```

### What the Cleanup Job Does

1. **Finds eligible users:**
   - `data_retention_expires_at IS NOT NULL`
   - `NOW() > data_retention_expires_at`
   - User does NOT have active paid subscription
   - Tier is NOT `'basic'`, `'advanced'`, or `'elite'` with active status

2. **For each eligible user:**
   - Deletes all `agent_messages` where `user_id = X`
   - Deletes all `agent_conversations` where `user_id = X`
   - Updates subscription: `tier = 'data_cleared'`, `status = 'inactive'`
   - Updates profile: `subscription_tier = 'data_cleared'`, `subscription_status = 'inactive'`

3. **Preserves:**
   - `auth.users` row
   - `profiles` row
   - `subscriptions` row
   - `agents` rows (agent definitions)
   - `has_used_trial` flag

4. **Idempotent:**
   - Safe to run multiple times
   - Won't error if data already deleted
   - Won't duplicate work

## Login & Access Behavior

### After Trial Expiration (Within 30 Days)

When user logs in:
- `tier = 'trial_expired'`
- `status = 'expired'`
- `data_retention_expires_at` is in the future
- **Access:** Limited/no access (cannot use app features)
- **UI:** Shows banner: "Your free trial has ended. Your agents and chat history will be kept for X days..."
- **Action:** User must upgrade to continue

### After Paid Cancellation (Within 60 Days)

When user logs in:
- `tier = 'basic'/'advanced'/'elite'` (or previous tier)
- `status = 'canceled'` or `'paused'`
- `data_retention_expires_at` is in the future
- **Access:** Limited/read-only (depending on implementation)
- **UI:** Shows banner: "Your subscription is canceled. Your agents and chat history will be kept for X days..."
- **Action:** User can reactivate subscription

### After Data Has Been Cleared

When user logs in:
- `tier = 'data_cleared'`
- `status = 'inactive'`
- `data_retention_expires_at` is in the past (or NULL)
- **Access:** No active access
- **UI:** Shows banner: "Your previous chat history has been cleared due to inactivity..."
- **Action:** User must subscribe again to use the app
- **Trial:** User CANNOT get another free trial (`has_used_trial = true`)

## Frontend Integration

### Components

1. **`DataRetentionBanner`** - Displays retention warnings
   - Shows different messages based on retention reason
   - Displays days remaining countdown
   - Links to pricing/subscription page

2. **`useDataRetention` Hook** - React hook for retention status
   - Fetches retention status from API
   - Provides: `isTrialExpired`, `isInRetentionWindow`, `daysRemaining`, `isDataCleared`, `retentionReason`

### API Routes

1. **`/api/subscription/retention-status`** - Get retention status for authenticated user
2. **`/api/admin/data-retention-cleanup`** - Run cleanup job (scheduled)

## Server-Side Functions

### Database Functions (PostgreSQL)

1. **`expire_trial_with_retention(user_id_param UUID)`**
   - Expires trial and sets 30-day retention window

2. **`set_paid_cancellation_retention(user_id_param UUID)`**
   - Sets 60-day retention window for canceled/paused paid subscriptions

3. **`clear_retention_on_reactivation(user_id_param UUID)`**
   - Clears retention window when user upgrades/reactivates

4. **`clear_user_interaction_data(user_id_param UUID)`**
   - Deletes interaction data for a specific user (used by cleanup job)

5. **`run_data_retention_cleanup()`**
   - Main cleanup function (finds and clears all eligible users)

### TypeScript Functions

1. **`lib/subscription/data-retention.ts`**
   - `setTrialExpirationRetention()` - Set 30-day window
   - `setPaidCancellationRetention()` - Set 60-day window
   - `clearRetentionOnReactivation()` - Clear window on upgrade
   - `getDataRetentionStatus()` - Get retention status
   - `isInRetentionWindow()` - Check if in window
   - `isDataCleared()` - Check if data cleared

## Safety & Constraints

### Server-Side Enforcement

- All retention logic runs server-side
- Frontend banners are informational only
- Access control is enforced in API routes and middleware

### Never Reset Flags

- `has_used_trial` is NEVER reset
- Trial history (`trial_started_at`, `trial_ended_at`) is preserved
- Subscription history is preserved

### Never Delete Identity

- `auth.users` is NEVER deleted by cleanup job
- `profiles` is NEVER deleted
- `subscriptions` is NEVER deleted
- Only interaction/memory data is deleted

### RLS Bypass

- Cleanup functions use `SECURITY DEFINER` to bypass RLS
- Service role client is used for cleanup operations
- Regular user operations still respect RLS

## Environment Variables

Add to `.env.local`:

```bash
# Optional: Secret for cleanup job authentication
DATA_RETENTION_CLEANUP_SECRET=your_random_secret_here
```

## Testing

### Test Trial Expiration

1. Create a test user
2. Manually set `trial_ends_at` to past date
3. Call `expireTrial(userId)`
4. Verify `data_retention_expires_at` is set to 30 days from now
5. Verify `data_retention_reason = 'trial_expired'`

### Test Paid Cancellation

1. Create a paid user
2. Cancel subscription via Stripe webhook or API
3. Verify `data_retention_expires_at` is set to 60 days from now
4. Verify `data_retention_reason = 'paid_canceled'`

### Test Cleanup Job

1. Create a user past retention window
2. Call cleanup job: `POST /api/admin/data-retention-cleanup`
3. Verify interaction data is deleted
4. Verify subscription tier = `'data_cleared'`
5. Verify `has_used_trial` is still `true`
6. Verify `auth.users` and `profiles` still exist

## Migration Notes

The migration `20241130000000_add_data_retention.sql`:
- Adds retention fields to `subscriptions` and `profiles` tables
- Adds `'data_cleared'` tier and `'inactive'` status
- Creates cleanup functions
- Updates existing functions to set retention windows
- Is idempotent (safe to run multiple times)

## Summary

The system ensures:
1. ✅ Users get 3-day free trial
2. ✅ Trial users get 30-day grace period after expiration
3. ✅ Paid users get 60-day grace period after cancellation
4. ✅ One-trial-per-email is enforced (never reset)
5. ✅ User identity and agents are preserved
6. ✅ Interaction data is cleaned up after retention expires
7. ✅ All logic is server-side enforced
8. ✅ Cleanup job is idempotent and safe













