# Custom Domain Configuration Verification

## Current Supabase Configuration ✅

**Project URL (Custom Domain)**: `https://auth.ovrsee.ai`
- Status: ✅ Custom domain active
- This is your Supabase API endpoint

## What Needs to Match

### 1. Environment Variable ✅
Your `.env` file should have:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://auth.ovrsee.ai
```

**NOT** `https://nupxbdbychuqokubresi.supabase.co` (unless you want to use the default)

### 2. Google OAuth Callback URL ✅
In Google Console, you should have **BOTH**:
- `https://auth.ovrsee.ai/auth/v1/callback` ✅ (Custom domain - preferred)
- `https://nupxbdbychuqokubresi.supabase.co/auth/v1/callback` ✅ (Fallback)

You already have the custom domain one in your Google OAuth config!

### 3. Supabase Dashboard - URL Configuration
Go to **Settings** → **Authentication** → **URL Configuration**:
- **Site URL**: `https://ovrsee.ai` (your app domain, not Supabase domain)
- **Redirect URLs**: 
  ```
  https://ovrsee.ai/app
  https://ovrsee.ai/**
  ```

## Important Distinction

- **Supabase API URL** (`NEXT_PUBLIC_SUPABASE_URL`): `https://auth.ovrsee.ai`
  - Used for all API calls
  - Used for OAuth callbacks
  - This is what you see in API Settings ✅

- **App URL** (`NEXT_PUBLIC_APP_URL`): `https://ovrsee.ai`
  - Where your Next.js app is hosted
  - Where users land after OAuth
  - Configured in Supabase Dashboard → Authentication → URL Configuration

## Verification Checklist

✅ **Supabase API Settings**: Custom domain `https://auth.ovrsee.ai` is active
✅ **Google OAuth**: Has `https://auth.ovrsee.ai/auth/v1/callback` in redirect URIs
❓ **Environment Variable**: Verify `NEXT_PUBLIC_SUPABASE_URL=https://auth.ovrsee.ai`
❓ **Supabase Dashboard**: Check Authentication → URL Configuration for app redirects

## If Using Custom Domain

**Benefits**:
- Cleaner branding (no Supabase domain visible)
- Better for production

**Requirements**:
1. Environment variable must use custom domain
2. Google OAuth must include custom domain callback
3. Supabase Dashboard redirect URLs must point to your app domain

## Quick Check

Run this to verify your environment variable:
```bash
# In your terminal
echo $NEXT_PUBLIC_SUPABASE_URL
# Should output: https://auth.ovrsee.ai
```

Or visit: `https://ovrsee.ai/api/auth/check-config` to see what URL is being used.



