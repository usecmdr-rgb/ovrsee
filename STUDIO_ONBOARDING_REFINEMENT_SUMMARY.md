# Studio Onboarding Refinement Summary

## Overview

Refined Studio onboarding UX to make it less blocking and more user-friendly. Only connecting social accounts is required; all other steps are optional and can be skipped.

## Changes Made

### 1. Onboarding Service Updates (`lib/studio/onboarding-service.ts`)

- **Added constants**:
  - `REQUIRED_STEPS`: `["connect_accounts"]`
  - `OPTIONAL_STEPS`: `["brand_profile", "first_plan", "review"]`

- **New function**: `isOnboardingRequired(workspaceId)`
  - Returns `true` only if workspace has **no connected social accounts**
  - Returns `false` once at least one account is connected
  - Used for gating access to Studio (not for completion tracking)

- **Updated**: `completeOnboardingStep()` 
  - Now accepts optional `{ skipped?: boolean }` parameter
  - Supports marking steps as skipped (for optional steps)

- **Kept**: `isOnboardingComplete()` 
  - Still checks if ALL steps are done (for UI display purposes)
  - Different from `isOnboardingRequired()` which only checks accounts

### 2. API Updates

- **`GET /api/studio/onboarding`**:
  - Now returns `is_required` field indicating if onboarding is still required
  - Uses `isOnboardingRequired()` to check account connection status

- **`POST /api/studio/onboarding/complete`**:
  - Now accepts optional `skipped` boolean in request body
  - Passes `skipped` flag to `completeOnboardingStep()`

### 3. Redirect Logic (`app/studio/page.tsx`)

- **Updated**: Uses `is_required` from API response instead of checking all steps
- **Behavior**: Only redirects to onboarding if no accounts are connected
- **Once connected**: User can access Studio even if other steps aren't done

### 4. Onboarding Page UI (`app/studio/onboarding/page.tsx`)

#### Step Configuration
- **Required step**: `connect_accounts` - marked with "Required" badge
- **Optional steps**: `brand_profile`, `first_plan`, `review` - marked with "Optional" badge
- **Step descriptions**: Updated to indicate optional steps

#### Connect Accounts Step
- **Primary button**: "Connect Accounts" (violet, prominent)
- **Action**: Routes to `/studio/settings?tab=accounts`
- **Visual**: Highlighted border and background for required step
- **No skip option**: Required step cannot be skipped

#### Optional Steps
- **Two buttons**:
  - "Get Started" (primary) - Routes to step-specific page
  - "Skip" (secondary) - Marks step as skipped and continues
- **Active state**: Optional steps become active once required step is complete
- **Visual**: Standard styling, less prominent than required step

#### Completion State
- **Required complete**: Shows "You're ready to start!" message
- **All complete**: Shows "You've completed all onboarding steps" message
- **Actions**:
  - "Go to Overview" - Always available once required step is done
  - "Skip Remaining Steps" - Only shown if optional steps remain, marks all as skipped

#### Step Completion Detection
- **connect_accounts**: Checks `/api/studio/social/accounts` for connected accounts (status !== "disconnected")
- **brand_profile**: Checks `/api/studio/brand-profile` for existing profile
- **first_plan**: Checks `/api/studio/posts` for any posts
- **review**: Manually marked when user clicks "Go to Overview"

### 5. User Flow

#### New User Flow
1. User lands on `/studio` → Redirected to `/studio/onboarding`
2. Sees "Connect Social Accounts" step with prominent "Connect Accounts" button
3. Clicks button → Routes to `/studio/settings?tab=accounts`
4. Connects at least one account → Returns to onboarding (or auto-completes)
5. Once connected, sees "You're ready to start!" message
6. Can either:
   - Complete optional steps (Brand Profile, Generate Plan, Review)
   - Skip optional steps and go directly to Overview
   - Click "Skip Remaining Steps" to mark all optional steps as skipped

#### Returning User Flow
- If accounts are connected → `/studio` redirects to `/studio/overview` (no onboarding)
- If no accounts → Redirected to onboarding (only required step)

## Backward Compatibility

✅ **All changes are backward compatible**:
- Existing onboarding state data structure unchanged
- Existing API endpoints still work (with new optional fields)
- Existing completion tracking still works
- Users who already completed onboarding are unaffected

## Files Modified

1. `lib/studio/onboarding-service.ts` - Added `isOnboardingRequired()`, updated `completeOnboardingStep()`
2. `app/api/studio/onboarding/route.ts` - Returns `is_required` field
3. `app/api/studio/onboarding/complete/route.ts` - Accepts `skipped` parameter
4. `app/studio/page.tsx` - Uses `is_required` instead of checking all steps
5. `app/studio/onboarding/page.tsx` - Complete UI overhaul with Connect/Skip buttons

## Testing Checklist

- [ ] New user with no accounts → Redirected to onboarding
- [ ] Connect Accounts button routes to settings page
- [ ] After connecting account → Can access Studio
- [ ] Optional steps show Skip button
- [ ] Skip button marks step as complete
- [ ] "Skip Remaining Steps" marks all optional steps as skipped
- [ ] Once required step complete → Can go to Overview
- [ ] Returning user with accounts → No onboarding redirect

## Notes

- The "Connect Accounts" button routes to `/studio/settings?tab=accounts` - this assumes the settings page has social account connection UI
- If the settings page doesn't have account connection UI, we may need to create a dedicated connection page or update the settings page
- OAuth flows (`/api/oauth/facebook/start`, `/api/oauth/tiktok/start`) exist but may need to be wired into the settings page UI

