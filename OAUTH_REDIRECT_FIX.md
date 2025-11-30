# Fix OAuth Redirect from localhost to ovrsee.ai

## Problem
When signing in with Google OAuth, the browser redirects from `localhost` to `ovrsee.ai` instead of staying on localhost.

## Root Cause
Supabase has a **Site URL** configured in the dashboard that overrides the `redirectTo` parameter in some cases.

## Solution

### Step 1: Check Supabase Site URL Configuration

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **Authentication** → **URL Configuration**
4. Check the **Site URL** field:
   - If it's set to `https://ovrsee.ai`, this is causing the redirect
   - For local development, it should be `http://localhost:3001` (or your dev port)

### Step 2: Update Site URL for Development

**Option A: Change Site URL to localhost (Recommended for Development)**
- Set **Site URL** to: `http://localhost:3001`
- Add to **Redirect URLs**:
  - `http://localhost:3001/app`
  - `http://localhost:3001/**` (wildcard for all localhost routes)

**Option B: Keep Production URL but Add localhost to Redirect URLs**
- Keep **Site URL** as `https://ovrsee.ai` (for production)
- Add to **Redirect URLs**:
  - `http://localhost:3001/app`
  - `http://localhost:3001/**`
  - `https://ovrsee.ai/app`
  - `https://ovrsee.ai/**`

### Step 3: Verify Google OAuth Redirect URI

1. Go to https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID (the one used for Supabase Auth)
3. Under **Authorized redirect URIs**, make sure you have:
   - `https://[your-project-id].supabase.co/auth/v1/callback`
   - (This is the Supabase callback URL, not your app URL)

### Step 4: Test

1. Clear browser cookies for localhost and ovrsee.ai
2. Try signing in with Google again
3. You should stay on `localhost:3001/app` after authentication

## Code Verification

The code in `components/modals/AuthModal.tsx` correctly uses:
```typescript
redirectTo: `${window.location.origin}/app`
```

This will be `http://localhost:3001/app` when running locally, so the issue is in Supabase configuration, not the code.

## Production vs Development

For production, you'll want:
- **Site URL**: `https://ovrsee.ai`
- **Redirect URLs**: Include both production and development URLs

For development, temporarily set:
- **Site URL**: `http://localhost:3001`
- **Redirect URLs**: `http://localhost:3001/app` and `http://localhost:3001/**`

