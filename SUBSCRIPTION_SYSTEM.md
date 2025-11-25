# Subscription-Aware Data Handling System

This document explains how the subscription system integrates Supabase, Stripe, and user data management.

## Architecture Overview

The system uses a **three-layer architecture**:

1. **Supabase Auth** (`auth.users`) - User authentication
2. **Supabase Database** - User profiles, subscriptions, agents, conversations, messages
3. **Stripe** - Payment processing and subscription management

## Database Schema

### Core Tables

#### `profiles`
- Linked to `auth.users.id` via foreign key
- Stores user profile data (name, email, company)
- Contains subscription fields for backward compatibility
- Auto-created via database trigger on user signup

#### `subscriptions` (Primary Source of Truth)
- Normalized subscription data
- One subscription per user (enforced by unique constraint)
- Stores tier, status, Stripe IDs, billing periods
- Automatically synced with `profiles` table via trigger

#### `agents`
- User-specific agent configurations
- Can be null for system-wide agents
- Never deleted on subscription changes

#### `agent_conversations`
- Conversation sessions with agents
- Linked to user and agent
- Preserved across subscription changes

#### `agent_messages`
- Individual messages in conversations
- Cascades delete with conversation
- All historical data preserved

## Data Flow

### 1. User Signup

```
User Signs Up
    ↓
Supabase Auth creates auth.users record
    ↓
Database trigger (handle_new_user) fires
    ↓
Creates profile in profiles table
Creates default subscription (free tier) in subscriptions table
    ↓
User can immediately use the app
```

**API Endpoint:** `POST /api/auth/signup`

**What Happens:**
- User account created in `auth.users`
- Profile auto-created via trigger
- Default `free` subscription created
- All data structures ready for use

### 2. User Login

```
User Logs In
    ↓
Authenticate with Supabase Auth
    ↓
Fetch profile and subscription from Supabase
    ↓
If user has Stripe customer ID:
    Sync subscription with Stripe
    Update Supabase if there are discrepancies
    ↓
Return complete session data (user + profile + subscription)
```

**API Endpoint:** `POST /api/auth/login`

**What Happens:**
- User authenticated
- Subscription synced with Stripe (if applicable)
- Session data includes tier, status, accessible agents
- All user data preserved

### 3. Subscription Upgrade/Downgrade

```
User Upgrades/Downgrades
    ↓
Update subscription in Stripe
    ↓
Update subscriptions table in Supabase
    ↓
Trigger syncs to profiles table
    ↓
User data (agents, conversations, messages) UNCHANGED
Only tier and access limits updated
```

**API Endpoint:** `POST /api/subscription/manage`

**What Happens:**
- Stripe subscription updated
- Supabase `subscriptions` table updated
- Profile table synced via trigger
- **All user data preserved** (agents, conversations, messages remain intact)

### 4. Subscription Cancellation

```
User Cancels Subscription
    ↓
Mark subscription as cancel_at_period_end in Stripe
    ↓
Update subscriptions table (cancel_at_period_end = true)
    ↓
User retains access until period_end
    ↓
All user data preserved (agents, conversations, messages)
```

**What Happens:**
- Subscription marked for cancellation at period end
- User keeps access until `current_period_end`
- After period end, tier may change to `free` but **data is preserved**
- User can reactivate anytime

### 5. Stripe Webhooks

```
Stripe Event (payment, subscription update, etc.)
    ↓
Webhook received at /api/stripe/webhook
    ↓
Verify signature
    ↓
Update subscriptions table (primary)
    ↓
Trigger syncs to profiles table
    ↓
Idempotent - safe to retry
```

**Webhook Events Handled:**
- `checkout.session.completed` - New subscription created
- `customer.subscription.updated` - Subscription changed
- `customer.subscription.deleted` - Subscription canceled
- `invoice.payment_succeeded` - Payment successful
- `invoice.payment_failed` - Payment failed

## Key Principles

### 1. Data Preservation
- **Never delete user data** on subscription changes
- Agents, conversations, and messages are permanent
- Only subscription tier and status change

### 2. Single Source of Truth
- `subscriptions` table is primary for subscription data
- `profiles` table synced via database trigger
- Stripe is authoritative for payment status

### 3. Idempotency
- All operations are safe to retry
- Webhook handlers are idempotent
- Database triggers handle edge cases

### 4. Tier-Based Access Control
- Access determined by `subscription.tier`
- Admin users bypass tier restrictions
- Access checked at API level and frontend

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Authenticate and sync subscription
- `GET /api/auth/session` - Get current session data

### Subscription Management
- `POST /api/subscription/manage` - Upgrade, downgrade, or cancel
- `POST /api/stripe/webhook` - Stripe webhook handler

### Conversation Persistence
- Use utilities from `lib/conversations/persistence.ts`
- All conversations and messages saved to Supabase
- Access controlled by user_id and RLS policies

## TypeScript Types

All database types are defined in `types/database.ts`:
- `Profile`, `Subscription`, `Agent`
- `AgentConversation`, `AgentMessage`
- `UserSession` (combined user + profile + subscription)

## Utilities

### Subscription Sync
`lib/subscription/sync.ts`
- `syncSubscriptionFromStripe()` - Sync Stripe → Supabase
- `getUserSubscription()` - Get subscription from Supabase
- `updateSubscriptionTier()` - Change tier (preserves data)
- `cancelSubscription()` - Cancel (preserves data)

### Session Management
`lib/auth/session.ts`
- `getUserSession()` - Get complete session data
- `getUserSessionFromToken()` - Get session from access token

### Conversation Persistence
`lib/conversations/persistence.ts`
- `createConversation()` - Create new conversation
- `addMessage()` - Add message to conversation
- `getConversationMessages()` - Get all messages
- All operations respect RLS policies

## Testing Checklist

### Signup Flow
- [ ] User signs up → Profile created
- [ ] User signs up → Subscription created (free tier)
- [ ] User signs up → Can access app immediately

### Login Flow
- [ ] User logs in → Subscription synced with Stripe
- [ ] User logs in → Session includes correct tier
- [ ] User logs in → Accessible agents correct

### Upgrade/Downgrade
- [ ] User upgrades → Tier updated in Supabase
- [ ] User upgrades → Stripe subscription updated
- [ ] User upgrades → All data preserved
- [ ] User downgrades → Tier updated
- [ ] User downgrades → Data preserved

### Cancellation
- [ ] User cancels → Marked for cancellation
- [ ] User cancels → Access until period end
- [ ] User cancels → All data preserved

### Webhooks
- [ ] Payment succeeds → Status updated to active
- [ ] Payment fails → Status updated to past_due
- [ ] Subscription updated → Supabase synced
- [ ] Webhook retries → Idempotent (no duplicates)

## Security

- **Row Level Security (RLS)** enabled on all tables
- Users can only access their own data
- Admin users have special privileges
- All API endpoints require authentication
- Webhook signature verification

## Migration

To apply the database schema:

1. Run migration: `supabase/migrations/20241128000000_comprehensive_subscription_schema.sql`
2. Verify tables created: `profiles`, `subscriptions`, `agents`, `agent_conversations`, `agent_messages`
3. Verify triggers: `handle_new_user`, `sync_profile_subscription`
4. Verify RLS policies are active

## Future Enhancements

- [ ] Email verification flow
- [ ] Subscription usage tracking
- [ ] Grace period for past_due subscriptions
- [ ] Automated tier downgrade after cancellation period
- [ ] Subscription analytics dashboard

