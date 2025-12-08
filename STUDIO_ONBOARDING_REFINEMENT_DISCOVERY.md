# Studio Onboarding Refinement Discovery

## Current Implementation

### Onboarding Checklist UI
- **File**: `app/studio/onboarding/page.tsx`
- **Current behavior**:
  - Shows 4 steps: connect_accounts, brand_profile, first_plan, review
  - Steps are clickable cards that route to different pages
  - "Get started →" text link for each step
  - Completion is checked by fetching actual data (accounts, brand profile, posts)
  - All steps must be completed to show "You're all set!" message

### Brand Profile UI & API
- **UI**: `app/studio/settings/page.tsx`
  - Full form with brand description, target audience, voice/tone, brand attributes
  - Save button that calls API
- **API**: `app/api/studio/brand-profile/route.ts`
- **Service**: `lib/studio/brand-profile-service.ts` (likely exists)

### Onboarding State Tracking
- **Table**: `studio_onboarding_state`
  - Columns: `workspace_id` (PK), `completed_steps` (array of step IDs), `created_at`, `updated_at`
- **Service**: `lib/studio/onboarding-service.ts`
  - Functions: `getOnboardingState()`, `completeOnboardingStep()`, `isOnboardingComplete()`, `isStepCompleted()`
  - Step IDs: `"connect_accounts" | "brand_profile" | "first_plan" | "review"`
- **API Routes**:
  - `GET /api/studio/onboarding` - Get state
  - `POST /api/studio/onboarding/complete` - Mark step complete (takes `{ step: string }`)

### Social Account Connection
- **Current routing**: Onboarding page routes to `/studio/settings?tab=accounts` for connect_accounts step
- **API**: `app/api/studio/social/connect/route.ts` exists
- **Accounts API**: `app/api/studio/social/accounts/route.ts` exists
- **Settings page**: `app/studio/settings/page.tsx` likely has social account connection UI

### Current Step Flow
1. **connect_accounts**: Routes to `/studio/settings?tab=accounts`
2. **brand_profile**: Routes to `/studio/settings?tab=brand`
3. **first_plan**: Routes to `/studio/calendar?action=generate-plan`
4. **review**: Routes to `/studio/overview`

### Issues Identified
1. ✅ FIXED: No clear "Connect" button - just text link "Get started →"
2. ✅ FIXED: All steps appear required (no skip option)
3. ✅ FIXED: Completion logic requires all steps
4. ✅ FIXED: No distinction between required vs optional steps

### OAuth Connection Routes
- **Facebook**: `/api/oauth/facebook/start` - Redirects to Facebook OAuth
- **TikTok**: `/api/oauth/tiktok/start` - Redirects to TikTok OAuth
- **Instagram**: Likely handled via Facebook OAuth (Instagram Business accounts)
- **Settings Page**: `/studio/settings?tab=accounts` - Likely has UI for connecting accounts

