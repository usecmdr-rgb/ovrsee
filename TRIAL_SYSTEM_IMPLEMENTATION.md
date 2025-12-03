# One-Time Trial System Implementation

## Overview

This document explains the implementation of the one-time free trial system that prevents users from reusing the same email address to get multiple free trials.

## Approach: Extended Profiles Table (Option A)

We chose to extend the existing `profiles` table rather than creating a separate `trial_history` table because:
- Simpler schema (fewer tables to manage)
- Direct relationship with user data
- Easier queries (no joins needed)
- Soft deletion preserves trial history

## Database Schema

### New Columns in `profiles` Table

1. **`has_used_trial`** (BOOLEAN, default FALSE)
   - Flag indicating if this email has ever used the free trial
   - **NEVER reset**, even if:
     - Trial ends
     - User cancels subscription
     - Account is deleted (soft-deleted)
   - This is the primary enforcement mechanism

2. **`trial_used_at`** (TIMESTAMP WITH TIME ZONE)
   - Records when the trial was first used
   - Used for audit purposes
   - Helps identify when trial was consumed

3. **`deleted_at`** (TIMESTAMP WITH TIME ZONE)
   - Soft deletion timestamp
   - When set, account is considered deleted but data is preserved
   - Allows trial history to persist even if user "deletes" account

4. **`email_normalized`** (TEXT, indexed)
   - Normalized (lowercase, trimmed) email address
   - Ensures consistent email comparison
   - Prevents case/whitespace variations from bypassing checks
   - Indexed for fast lookups

### Migration File

See: `supabase/migrations/20241128000000_add_trial_tracking.sql`

## Server-Side Enforcement

### Core Helper Functions (`lib/trial-eligibility.ts`)

1. **`normalizeEmail(email: string)`**
   - Converts email to lowercase and trims whitespace
   - Ensures "User@Example.com" = "user@example.com"

2. **`hasEmailUsedTrial(email: string)`**
   - Checks if any profile (including soft-deleted) has `has_used_trial = true`
   - Uses normalized email for comparison
   - Returns `true` if email has used trial, `false` otherwise
   - **This is the primary eligibility check**

3. **`markTrialAsUsed(userId: string, email: string)`**
   - Sets `has_used_trial = true`
   - Sets `trial_used_at = now()`
   - Sets `email_normalized = normalized email`
   - **Called when trial starts - flag is NEVER reset**

4. **`isUserOnActiveTrial(userId: string)`**
   - Checks if user is currently on an active trial
   - Validates trial hasn't expired

5. **`isTrialExpired(userId: string)`**
   - Checks if user's trial has expired
   - Validates `trial_ends_at` timestamp

6. **`expireTrial(userId: string)`**
   - Transitions user from `trial` to `trial_expired` tier
   - Sets status to `expired`

## API Endpoints

### `/api/trial/start` (POST)

**Security & Enforcement:**
- Requires authentication (uses `requireAuthFromRequest`)
- Checks `hasEmailUsedTrial()` before starting trial
- If email has used trial, returns 403 with clear error message
- If eligible, calls `markTrialAsUsed()` to permanently flag the email
- Creates Stripe subscription with 3-day trial period

**Error Codes:**
- `TRIAL_ALREADY_USED`: Email has already used a trial
- `TRIAL_ALREADY_ACTIVE`: User is already on an active trial

### `/api/subscription` (GET)

**Trial Expiration Handling:**
- Automatically checks if trial has expired
- If expired, calls `expireTrial()` to transition user
- Returns trial status in response:
  ```typescript
  {
    subscription: { ... },
    paymentMethod: { ... },
    trial: {
      hasUsedTrial: boolean,
      isExpired: boolean
    }
  }
  ```

## Frontend Integration

### Hook: `useTrialStatus()` (`hooks/useTrialStatus.ts`)

Provides reactive trial status:
- `hasUsedTrial`: Whether email has ever used a trial
- `isOnTrial`: Whether user is currently on active trial
- `isTrialExpired`: Whether trial has expired
- `canStartTrial`: Whether user is eligible to start a new trial
- `loading`: Loading state
- `error`: Error state

### UI Updates (`components/pricing/PricingTable.tsx`)

**Trial-Ineligible Users:**
- Shows warning message: "You have already used your free trial"
- Disables "Start Trial" button
- Shows message: "Please choose a paid plan to continue"

**Active Trial Users:**
- Shows: "You're currently on a free trial"
- Disables "Start Trial" button
- Encourages choosing a plan

**Trial-Eligible Users:**
- Shows "Start Trial" button
- Normal trial flow

## How It Prevents Trial Abuse

### 1. Email-Based Tracking
- Trial eligibility is tied to **normalized email**, not user ID
- Even if user deletes account and creates new one with same email, `has_used_trial` persists

### 2. Soft Deletion
- Accounts are soft-deleted (`deleted_at` set) rather than hard-deleted
- Trial history is preserved in database
- Prevents "delete and recreate" abuse

### 3. Server-Side Enforcement
- All checks happen server-side in API routes
- Frontend can't bypass restrictions
- Even if UI is manipulated, backend enforces rules

### 4. Normalized Email Comparison
- Email is normalized (lowercase, trimmed) before comparison
- Prevents case/whitespace variations from bypassing checks
- "User@Example.com" and "user@example.com" are treated as same

### 5. Permanent Flag
- `has_used_trial` is **NEVER reset**
- Once set to `true`, it remains `true` forever
- Prevents any attempt to "reset" trial status

## Limitations

### What We CAN Prevent:
✅ Reusing same email for multiple trials  
✅ Deleting account and recreating with same email  
✅ Case variations of same email  
✅ Whitespace variations of same email  

### What We CANNOT Prevent:
❌ Users creating accounts with completely different emails  
❌ Users using disposable email services  
❌ Users using multiple legitimate email addresses  

**Note:** This is expected and acceptable. The goal is to prevent abuse of the same email, not to prevent legitimate multi-account usage.

## Security Considerations

1. **Server-Side Only**: All eligibility checks are server-side
2. **Authentication Required**: Trial start requires valid authentication
3. **Email Normalization**: Prevents case/whitespace bypass attempts
4. **Permanent Flags**: Trial usage flags are never reset
5. **Soft Deletion**: Preserves trial history even if account is "deleted"

## Testing Checklist

- [ ] New user can start trial
- [ ] User who used trial cannot start another trial
- [ ] User who deleted account cannot start trial with same email
- [ ] Case variations of email are treated as same
- [ ] Trial expiration is automatically handled
- [ ] Frontend shows appropriate messages for ineligible users
- [ ] Server enforces rules even if frontend is bypassed

## Migration Instructions

1. Run the migration SQL in Supabase dashboard:
   ```sql
   -- See: supabase/migrations/20241128000000_add_trial_tracking.sql
   ```

2. The migration will:
   - Add new columns to `profiles` table
   - Create index on `email_normalized`
   - Update existing profiles with normalized emails (if possible)

3. No code changes needed - system will work immediately after migration

## Future Enhancements

Potential improvements (not implemented):
- IP-based tracking (additional layer)
- Device fingerprinting (for additional verification)
- Rate limiting on trial starts
- Admin override for special cases













