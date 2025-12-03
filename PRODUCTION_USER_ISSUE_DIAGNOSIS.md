# Production User Account Issue Diagnosis

## Problem
User account works on localhost but not on live website.

## Diagnostic Endpoint

Visit this endpoint while logged in on production:
```
https://ovrsee.ai/api/auth/diagnose-user
```

This will show:
- Session status
- Profile existence
- Subscription status
- Cookie configuration
- Environment differences
- Specific recommendations

## Common Causes

### 1. Profile Not Created
**Symptoms:**
- Session exists but profile doesn't
- User can't access features
- API calls fail with "profile not found"

**Fix:**
- Visit `/api/auth/ensure-profile` (POST) to create profile
- Check if database trigger `handle_new_user()` is working
- Verify trigger exists in Supabase migrations

### 2. Cookie Domain Issue
**Symptoms:**
- Session lost on page refresh
- Cookies not persisting
- Works on localhost but not production

**Fix:**
- Check middleware cookie domain configuration
- Verify cookies have domain `.ovrsee.ai` in production
- Check `/api/auth/check-config` for cookie details

### 3. Supabase URL Mismatch
**Symptoms:**
- Connection errors
- "Unable to connect to authentication service"
- Different Supabase project used

**Fix:**
- Verify `NEXT_PUBLIC_SUPABASE_URL` matches in production
- Check if using custom domain (`https://auth.ovrsee.ai`) vs project URL
- Ensure same Supabase project for localhost and production

### 4. CORS Issues
**Symptoms:**
- Network errors in browser console
- CORS errors in DevTools
- Requests blocked

**Fix:**
- Check Supabase Dashboard → Settings → API → Allowed Origins
- Add `https://ovrsee.ai` to allowed origins
- Verify CSP in middleware allows Supabase connections

### 5. Content Security Policy (CSP)
**Symptoms:**
- Requests blocked by browser
- Console errors about CSP violations
- Supabase API calls fail

**Fix:**
- Check middleware CSP configuration
- Ensure `connect-src` includes Supabase domains
- Current CSP should include: `https://*.supabase.co` and `https://auth.ovrsee.ai`

### 6. Environment Variables
**Symptoms:**
- Different behavior between localhost and production
- Configuration errors
- Missing features

**Fix:**
- Verify all environment variables are set in production
- Check `NEXT_PUBLIC_SUPABASE_URL`
- Check `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check `NEXT_PUBLIC_APP_URL`

### 7. RLS (Row Level Security) Policies
**Symptoms:**
- Profile exists but can't be accessed
- Subscription exists but can't be read
- Permission denied errors

**Fix:**
- Check RLS policies in Supabase
- Verify policies allow authenticated users to read their own data
- Check if service role key is needed for certain operations

## Step-by-Step Diagnosis

### Step 1: Check Session
```bash
GET /api/auth/diagnose-user
```
Look for:
- `session.exists: true`
- `session.userId` is set
- `session.email` matches your account

### Step 2: Check Profile
In the diagnostic response, check:
- `profile.exists: true`
- `profile.error` is null
- Profile data is present

If profile doesn't exist:
```bash
POST /api/auth/ensure-profile
```

### Step 3: Check Cookies
In browser DevTools:
1. Open Application → Cookies
2. Look for cookies starting with `sb-`
3. Verify domain is `.ovrsee.ai` or `ovrsee.ai`
4. Verify `Secure: true` (for HTTPS)
5. Verify `SameSite: lax`

### Step 4: Check Environment
```bash
GET /api/auth/check-connection
```
Verify:
- Supabase URL is set correctly
- Supabase anon key is set
- Connection to Supabase works

### Step 5: Check Browser Console
Look for:
- Network errors
- CORS errors
- CSP violations
- Authentication errors

## Quick Fixes

### Fix 1: Create Missing Profile
If profile doesn't exist:
```bash
POST /api/auth/ensure-profile
Authorization: Bearer <your_access_token>
```

### Fix 2: Clear Cookies and Re-login
1. Clear all cookies for `ovrsee.ai`
2. Clear browser cache
3. Log in again
4. Check if session persists

### Fix 3: Verify Supabase Configuration
1. Check Supabase Dashboard → Settings → API
2. Verify URL matches `NEXT_PUBLIC_SUPABASE_URL`
3. Verify anon key matches `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Check Allowed Origins includes `https://ovrsee.ai`

### Fix 4: Check CSP
In `middleware.ts`, verify CSP includes:
```javascript
connect-src 'self' https://*.supabase.co https://auth.ovrsee.ai
```

## Comparison: Localhost vs Production

| Aspect | Localhost | Production |
|--------|-----------|------------|
| Supabase URL | `http://localhost:54321` or project URL | `https://auth.ovrsee.ai` or project URL |
| Cookie Domain | Not set (defaults to localhost) | `.ovrsee.ai` |
| Cookie Secure | `false` | `true` |
| Protocol | `http://` | `https://` |
| CSP | Less strict | More strict |
| CORS | Usually permissive | Must be configured |

## Testing Checklist

- [ ] Can log in on production
- [ ] Session persists after page refresh
- [ ] Profile exists (check `/api/auth/diagnose-user`)
- [ ] Subscription exists (if applicable)
- [ ] Can access `/app` page
- [ ] Can access agent pages
- [ ] API calls work (check browser console)
- [ ] No CORS errors
- [ ] No CSP violations
- [ ] Cookies are set correctly

## Related Endpoints

- `/api/auth/diagnose-user` - Comprehensive user diagnostics
- `/api/auth/check-config` - Configuration check
- `/api/auth/check-connection` - Supabase connection test
- `/api/auth/ensure-profile` - Create profile if missing
- `/api/auth/verify-account` - Account verification

## Next Steps

1. Visit `/api/auth/diagnose-user` on production
2. Review the recommendations
3. Check browser console for errors
4. Compare with localhost behavior
5. Apply fixes based on diagnostic results



