# OAuth Cookie & URL Configuration Check

## Current Configuration Analysis

### 1. Cookie Settings ✅
- **Middleware**: Uses `@supabase/ssr` which automatically handles cookie options
- **Cookie Path**: Set to `/` (site-wide)
- **Cookie Domain**: Not explicitly set (browser handles automatically)
- **SameSite**: Handled by Supabase SSR (defaults to 'lax', 'none' for cross-site)
- **Secure**: Automatically set to `true` for HTTPS

### 2. Redirect URL Configuration
**Current Code** (`components/modals/AuthModal.tsx`):
- Development: `http://localhost:3000/app`
- Production: `${window.location.origin}/app` (should be `https://ovrsee.ai/app`)

### 3. Environment Variables Needed
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `NEXT_PUBLIC_APP_URL` - Should be `https://ovrsee.ai` for production

## Required Supabase Dashboard Configuration

### Step 1: Check Site URL
1. Go to **Supabase Dashboard** → **Settings** → **Authentication** → **URL Configuration**
2. **Site URL** should be: `https://ovrsee.ai`
3. This is the base URL Supabase uses for redirects

### Step 2: Check Redirect URLs
In the same section, **Redirect URLs** must include:
```
https://ovrsee.ai/app
https://ovrsee.ai/**
http://localhost:3000/app
http://localhost:3000/**
```

**Important**: The wildcard `/**` allows any path under that domain.

### Step 3: Verify Google OAuth Configuration
1. Go to **Supabase Dashboard** → **Authentication** → **Providers** → **Google**
2. Make sure Google provider is enabled
3. Check that Client ID and Client Secret are set

## Diagnostic Endpoints

### Check Configuration
Visit: `https://ovrsee.ai/api/auth/check-config`

This will show:
- Current URL configuration
- Cookie information
- Session status
- OAuth redirect settings
- Recommendations

### Verify Account
Visit: `https://ovrsee.ai/api/auth/verify-account` (requires login)

This will show:
- Profile exists
- Subscription exists
- Workspace exists
- Any missing pieces

## Common Issues & Fixes

### Issue 1: Cookies Not Persisting
**Symptoms**: Session lost after redirect
**Fix**: 
- Check browser DevTools → Application → Cookies
- Verify cookies have `Domain: .ovrsee.ai` or `ovrsee.ai`
- Verify `SameSite: lax` or `none`
- Verify `Secure: true` (for HTTPS)

### Issue 2: Wrong Redirect URL
**Symptoms**: Redirected to wrong domain or path
**Fix**:
- Verify `NEXT_PUBLIC_APP_URL` is set to `https://ovrsee.ai`
- Verify Supabase Redirect URLs include `https://ovrsee.ai/app`
- Clear browser cache and cookies

### Issue 3: OAuth Callback Fails
**Symptoms**: Error after Google authentication
**Fix**:
- Check Supabase logs (Dashboard → Logs → API)
- Verify Google OAuth credentials in Supabase
- Verify redirect URL matches exactly in both Supabase and Google Console

## Testing Steps

1. **Clear cookies and cache**
   - Open DevTools → Application → Clear storage → Clear site data

2. **Check configuration**
   - Visit `/api/auth/check-config`
   - Verify all settings are correct

3. **Test OAuth login**
   - Click "Sign in with Google"
   - Complete authentication
   - Check if session persists after redirect

4. **Verify account**
   - Visit `/api/auth/verify-account`
   - Ensure profile, subscription, and workspace exist

## Browser Cookie Inspection

To check cookies in browser:
1. Open DevTools (F12 or Cmd+Option+I)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click **Cookies** → Your domain
4. Look for cookies starting with `sb-` or containing `supabase`
5. Check:
   - **Name**: Should start with `sb-` or contain `auth`
   - **Value**: Should contain session token
   - **Domain**: Should be `.ovrsee.ai` or `ovrsee.ai`
   - **Path**: Should be `/`
   - **Expires**: Should be in the future
   - **HttpOnly**: Should be `true` (security)
   - **Secure**: Should be `true` (HTTPS only)
   - **SameSite**: Should be `lax` or `none`

## Next Steps

1. ✅ Run `/api/auth/check-config` to see current configuration
2. ✅ Verify Supabase Dashboard settings match recommendations
3. ✅ Test OAuth login and check if session persists
4. ✅ Inspect cookies in browser DevTools
5. ✅ Check `/api/auth/verify-account` to ensure account is complete




