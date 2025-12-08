# Multi-Seat Activation Flow Implementation Summary

## Overview
This document summarizes the implementation of a multi-seat activation flow that sends activation emails from Microsoft 365 (support@ovrsee.ai) and creates linked user accounts when invitees click activation links.

## New/Updated Files

### 1. Email Infrastructure
- **`lib/email.ts`** (NEW)
  - Email sending utility using nodemailer with Microsoft 365 SMTP
  - Exports `sendSupportEmail()` function
  - Uses environment variables: `MS365_SMTP_HOST`, `MS365_SMTP_PORT`, `MS365_SMTP_USER`, `MS365_SMTP_PASS`
  - Default "from" address: `OVRSEE Support <support@ovrsee.ai>`

### 2. Database Schema
- **`supabase/migrations/20250120000000_workspace_seat_invites.sql`** (NEW)
  - Creates `workspace_seat_invites` table for token-based invitations
  - Includes RLS policies for workspace owners and invitees
  - Includes function to expire old invites

### 3. API Routes
- **`app/api/workspaces/[workspaceId]/invite/route.ts`** (NEW)
  - POST endpoint to create seat invitations
  - Validates workspace ownership
  - Generates secure invite tokens (32 bytes)
  - Sends activation emails via `sendSupportEmail()`
  - Returns activation URL

- **`app/api/workspaces/accept-invite/route.ts`** (NEW)
  - POST endpoint to accept invitations
  - Enforces email match (security)
  - Creates/updates workspace seats
  - Marks invites as accepted (single-use tokens)
  - Syncs Stripe subscription

### 4. Frontend Pages
- **`app/activate-seat/page.tsx`** (NEW)
  - Activation page that reads token from query string
  - Handles authentication flow (redirects to login if needed)
  - Shows loading, success, and error states
  - Calls accept-invite API once authenticated

### 5. Helper Functions
- **`lib/workspace-helpers.ts`** (UPDATED)
  - Added `getUserEffectivePlanFromWorkspace()` - gets user's plan from workspace membership
  - Added `isUserWorkspaceMember()` - checks if user is a workspace member

### 6. Dependencies
- **`package.json`** (UPDATED)
  - Added `nodemailer` and `@types/nodemailer`

## Database Migration SQL

The following SQL is included in `supabase/migrations/20250120000000_workspace_seat_invites.sql`:

```sql
-- Workspace Seat Invites Table
CREATE TABLE IF NOT EXISTS workspace_seat_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  plan_code TEXT CHECK (plan_code IN ('essentials', 'professional', 'executive')),
  tier TEXT CHECK (tier IN ('basic', 'advanced', 'elite')),
  invite_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_seat_invites_workspace_id ON workspace_seat_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_seat_invites_invite_token ON workspace_seat_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_workspace_seat_invites_invited_email ON workspace_seat_invites(invited_email);
CREATE INDEX IF NOT EXISTS idx_workspace_seat_invites_status ON workspace_seat_invites(status);

-- RLS Policies
ALTER TABLE workspace_seat_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners can view seat invites"
  ON workspace_seat_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_seat_invites.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view invites for their email"
  ON workspace_seat_invites FOR SELECT
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Workspace owners can manage seat invites"
  ON workspace_seat_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_seat_invites.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can accept invites for their email"
  ON workspace_seat_invites FOR UPDATE
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Function to expire old invites
CREATE OR REPLACE FUNCTION expire_workspace_seat_invites()
RETURNS void AS $$
BEGIN
  UPDATE workspace_seat_invites
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Environment Variables Required

Add these to your `.env` file:

```bash
# Microsoft 365 SMTP Configuration
MS365_SMTP_HOST=smtp.office365.com
MS365_SMTP_PORT=587
MS365_SMTP_USER=nematollah@ovrsee.onmicrosoft.com
MS365_SMTP_PASS=<app-password-or-secret>

# App URL (for activation links)
NEXT_PUBLIC_APP_URL=https://ovrsee.ai  # or http://localhost:3000 for dev
```

## Security Features Implemented

1. **Single-use tokens**: Once an invite is accepted, its status changes to 'accepted' and cannot be reused
2. **Email match enforcement**: Only the user whose email matches `invited_email` can claim the invite
3. **Expiration handling**: Invites expire after 7 days
4. **Workspace ownership verification**: Only workspace owners can create invitations
5. **Token generation**: Uses cryptographically secure `randomBytes(32)` for invite tokens

## Manual Test Plan

### Prerequisites
1. Ensure Microsoft 365 SMTP credentials are configured in `.env`
2. Run the database migration: `supabase/migrations/20250120000000_workspace_seat_invites.sql`
3. Ensure you have a workspace with a team/workspace subscription

### Test Steps

#### Step 1: Create an Invitation
1. Sign in as a workspace owner
2. Get your workspace ID (from database or API)
3. Make a POST request to `/api/workspaces/[workspaceId]/invite`:
   ```json
   {
     "email": "someuser@example.com",
     "planCode": "essentials"
   }
   ```
4. Verify:
   - Response includes `ok: true` and invite data
   - Check email inbox for `someuser@example.com`
   - Email should be from `support@ovrsee.ai`
   - Email should contain activation button/link

#### Step 2: Verify Email Content
1. Open the email sent to `someuser@example.com`
2. Verify:
   - Subject: `[Workspace name] invited you to OVRSEE`
   - From: `OVRSEE Support <support@ovrsee.ai>`
   - Contains activation button/link
   - Link format: `https://ovrsee.ai/activate-seat?token=<64-char-hex-token>`

#### Step 3: Activate Seat (New User)
1. Click the activation link in the email (or navigate to `/activate-seat?token=<token>`)
2. If not signed in:
   - Should redirect to login modal
   - Sign up or sign in with `someuser@example.com`
3. After authentication:
   - Page should show "Activating your seat..."
   - Then show success message: "You're now part of [workspace] on the [plan] plan"
   - Should redirect to dashboard after 3 seconds
4. Verify in database:
   - `workspace_seat_invites` table: status = 'accepted', accepted_at is set
   - `workspace_seats` table: new row with user_id, status = 'active', tier matches invite

#### Step 4: Verify Subscription Linking
1. Check Stripe:
   - Workspace subscription should be updated with new seat
   - Subscription items should reflect the new seat count
2. Verify user has access:
   - User should be able to access workspace features
   - User's effective plan should match the invited tier

#### Step 5: Test Security Features
1. **Email mismatch test**:
   - Create invite for `user1@example.com`
   - Try to accept with `user2@example.com` account
   - Should fail with "EMAIL_MISMATCH" error

2. **Single-use token test**:
   - Accept an invite successfully
   - Try to use the same token again
   - Should fail with "ALREADY_ACCEPTED" error

3. **Expired invite test**:
   - Manually set `expires_at` to past date in database
   - Try to accept the invite
   - Should fail with "expired" error

4. **Unauthorized workspace access**:
   - Try to create invite for workspace you don't own
   - Should fail with 403 Forbidden

#### Step 6: Test Edge Cases
1. **User already has seat**:
   - Create invite for user who already has active seat
   - Should fail with "already has a seat" error

2. **Pending invite exists**:
   - Create invite for email
   - Try to create another invite for same email
   - Should fail with "invitation already sent" error

3. **Invalid token**:
   - Navigate to `/activate-seat?token=invalid`
   - Should show error: "Invalid or expired invitation"

## TODOs / Future Enhancements

The following features are stubbed/TODO for future implementation:

1. **Resend invite**: API endpoint to resend activation email for pending invites
2. **Revoke invite**: API endpoint to revoke pending invites (set status to 'revoked')
3. **List pending invites**: API endpoint to list all pending invites for a workspace
4. **Admin UX**: UI components for managing invites (list, resend, revoke)
5. **Seat limit enforcement**: Check workspace subscription limits before creating invites
6. **Yearly billing support**: Thread billing interval through invite creation

## API Endpoints Summary

### POST `/api/workspaces/[workspaceId]/invite`
- **Auth**: Required (workspace owner)
- **Body**: `{ email: string, planCode?: CorePlanCode, tier?: TierId }`
- **Returns**: `{ ok: true, data: { invite, activationUrl } }`

### POST `/api/workspaces/accept-invite`
- **Auth**: Required
- **Body**: `{ token: string }`
- **Returns**: `{ ok: true, message: string, data: { workspaceId, workspaceName, planCode, tier } }`

## Notes

- Invites expire after 7 days
- Activation emails are sent asynchronously (failures don't block invite creation)
- Workspace subscription is synced to Stripe after seat activation
- Members piggyback on workspace subscription (no separate billing)
- Feature gating should check workspace membership using `getUserEffectivePlanFromWorkspace()`


