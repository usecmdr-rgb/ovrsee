# OAuth Session Persistence Fix

## Issue
Google OAuth login sessions not persisting on live website. Users get logged out immediately after authentication.

## Root Cause
The middleware cookie configuration was not explicitly setting the domain for production, which caused cookies to not persist properly across OAuth redirects.

## Fix Applied

### Updated `middleware.ts`
- **Cookie Domain**: Now explicitly sets domain for production as `.ovrsee.ai` (with leading dot for subdomain support)
- **Cookie Security**: Maintains `secure: true` for HTTPS, `secure: false` for localhost
- **SameSite**: Uses `'lax'` for same-site OAuth (works for most cases)
- **Path**: Set to `/` for site-wide access

### Key Changes
1. **Production Domain Detection**: Extracts root domain from hostname and sets cookie domain with leading dot
2. **Localhost Handling**: Explicitly removes domain for localhost to ensure cookies work
3. **Cookie Options**: Properly handles undefined values to avoid cookie setting issues

## Cookie Configuration

### Production (HTTPS)
```
Domain: .ovrsee.ai (with leading dot for subdomain support)
Secure: true
SameSite: lax
Path: /
HttpOnly: (handled by Supabase SSR)
```

### Development (Localhost)
```
Domain: (not set - browser defaults to localhost)
Secure: false
SameSite: lax
Path: /
HttpOnly: (handled by Supabase SSR)
```

## Verification Steps

1. **Check Cookie Configuration**
   - Visit: `https://ovrsee.ai/api/auth/check-config`
   - Verify cookie settings are correct

2. **Test OAuth Login**
   - Clear browser cookies and cache
   - Sign in with Google
   - Check browser DevTools → Application → Cookies
   - Verify cookies have:
     - Domain: `.ovrsee.ai` or `ovrsee.ai`
     - Secure: `true`
     - SameSite: `lax`
     - Path: `/`

3. **Verify Session Persistence**
   - After login, refresh the page
   - Navigate to different pages
   - Session should persist

## Environment Variables Required

```bash
NEXT_PUBLIC_SUPABASE_URL=https://auth.ovrsee.ai
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=https://ovrsee.ai
```

## Supabase Dashboard Configuration

### URL Configuration
1. Go to **Supabase Dashboard** → **Settings** → **Authentication** → **URL Configuration**
2. **Site URL**: `https://ovrsee.ai`
3. **Redirect URLs**:
   ```
   https://ovrsee.ai/app
   https://ovrsee.ai/**
   http://localhost:3000/app
   http://localhost:3000/**
   ```

### Google OAuth Provider
1. Go to **Authentication** → **Providers** → **Google**
2. Ensure Google provider is enabled
3. Verify Client ID and Client Secret are set correctly

## Troubleshooting

### Cookies Still Not Persisting

1. **Check Browser Console**
   - Look for cookie-related errors
   - Check if cookies are being blocked

2. **Check Cookie Domain**
   - In DevTools → Application → Cookies
   - Verify domain is `.ovrsee.ai` (with leading dot)
   - If domain is wrong, clear cookies and try again

3. **Check HTTPS**
   - Ensure site is served over HTTPS
   - Cookies with `Secure: true` only work over HTTPS

4. **Check SameSite**
   - If using cross-site OAuth, may need `SameSite: none`
   - This requires `Secure: true`

### Session Lost After Redirect

1. **Verify Redirect URL**
   - Check Supabase Dashboard → Authentication → URL Configuration
   - Ensure redirect URL matches exactly: `https://ovrsee.ai/app`

2. **Check Middleware Logs**
   - Look for cookie setting logs in server logs
   - Verify domain is being set correctly

3. **Clear All Cookies**
   - Clear browser cookies for the domain
   - Try login again

## Testing Checklist

- [ ] Cookies have correct domain (`.ovrsee.ai`)
- [ ] Cookies have `Secure: true` in production
- [ ] Cookies have `SameSite: lax`
- [ ] Session persists after page refresh
- [ ] Session persists after navigation
- [ ] OAuth callback redirects correctly
- [ ] User stays logged in after OAuth flow

## Related Files

- `middleware.ts` - Cookie configuration
- `components/modals/AuthModal.tsx` - OAuth initiation
- `app/api/auth/check-config/route.ts` - Configuration diagnostics
- `lib/auth/getBaseUrl.ts` - Base URL helper

## Next Steps

1. Deploy the updated middleware
2. Test OAuth login on production
3. Verify cookies are set correctly
4. Monitor for any session issues




