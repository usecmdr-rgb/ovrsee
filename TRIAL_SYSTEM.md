# 3-Day Free Trial System

This document explains the 3-day free promotional trial implementation.

## Overview

New users automatically receive a **3-day free trial** with full access to all features. After the trial expires, users must upgrade to a paid plan or lose access.

## Database Schema

### Subscription Tiers
- `trial` - Active 3-day free trial
- `trial_expired` - Trial has expired, no access
- `basic`, `advanced`, `elite` - Paid tiers

### Subscription Status
- `active` - Active subscription (trial or paid)
- `expired` - Trial has expired
- `trialing` - Stripe trial period
- `canceled`, `past_due`, etc. - Other states

### Trial Fields
- `trial_started_at` - When trial began (signup timestamp)
- `trial_ends_at` - When trial expires (signup + 3 days)

## User Flow

### 1. Signup
```
User Signs Up
    ↓
Supabase Auth creates auth.users record
    ↓
Database trigger creates:
  - Profile with tier = 'trial'
  - Subscription with:
    - tier = 'trial'
    - status = 'active'
    - trial_started_at = NOW()
    - trial_ends_at = NOW() + 3 days
    ↓
User has full access to all agents for 3 days
```

### 2. Login (Trial Check)
```
User Logs In
    ↓
Check trial expiration
    ↓
If now() > trial_ends_at AND no Stripe subscription:
    - Set tier = 'trial_expired'
    - Set status = 'expired'
    ↓
Sync with Stripe (if customer exists)
    ↓
Return session with access status
```

### 3. Trial Expired
```
Trial Expired
    ↓
User has NO access to:
  - Agent features
  - Creating new conversations
  - API endpoints (403 error)
    ↓
User CAN:
  - View their data (read-only)
  - Upgrade to paid plan
    ↓
All data preserved (agents, conversations, messages)
```

### 4. Upgrade from Trial
```
User Upgrades
    ↓
Redirect to Stripe Checkout
    ↓
Payment successful
    ↓
Webhook updates subscription:
    - tier = 'basic' | 'advanced' | 'elite'
    - status = 'active'
    - Clear trial_started_at and trial_ends_at
    - Set stripe_subscription_id
    ↓
User immediately gets paid tier access
```

## Access Control

### Trial Users (`tier = 'trial'`)
- ✅ Full access to all agents (sync, aloha, studio, insight)
- ✅ Can create conversations and messages
- ✅ Can use all API endpoints
- ⏰ Access expires after 3 days

### Trial Expired Users (`tier = 'trial_expired'`)
- ❌ NO access to any agents
- ❌ Cannot create new conversations
- ❌ API endpoints return 403
- ✅ Can view existing data (read-only)
- ✅ Can upgrade to regain access

### Paid Users
- ✅ Access based on tier (basic/advanced/elite)
- ✅ Full functionality for their tier

## API Endpoints

### Trial Status
`GET /api/subscription/trial-status`
- Returns trial status, days remaining, expiration date
- Requires authentication

### Brain API
`POST /api/brain`
- Checks `hasActiveAccess()` before processing
- Returns 403 with `TRIAL_EXPIRED` code if trial expired

## Components

### TrialExpiredBanner
- Shows trial countdown during active trial
- Shows expiration message when trial expired
- Provides upgrade CTA

## Utilities

### `lib/subscription/trial.ts`
- `checkAndExpireTrial()` - Check and expire trials
- `getTrialStatus()` - Get trial information
- `hasActiveAccess()` - Check if user has active access

### `lib/auth/session.ts`
- Automatically checks trial expiration on login
- Returns `isTrialExpired` flag in session

## Migration

Run migration: `supabase/migrations/20241129000000_add_trial_support.sql`

This migration:
- Adds `trial` and `trial_expired` to tier enum
- Adds `expired` to status enum
- Adds `trial_started_at` and `trial_ends_at` columns
- Updates trigger to create trial subscription on signup
- Creates function to check and expire trials

## Testing Checklist

- [ ] New user signs up → Gets 3-day trial
- [ ] Trial user has full access to all agents
- [ ] Trial expires → User loses access
- [ ] Trial expired user cannot use API
- [ ] Trial expired user can upgrade
- [ ] Upgrade from trial → Immediate paid access
- [ ] Trial dates cleared on upgrade
- [ ] All user data preserved on expiration

