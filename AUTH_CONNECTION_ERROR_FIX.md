# Authentication Connection Error Fix

## Error Message
"Unable to connect to authentication service. Please try again later."

## Root Causes

This error occurs when the Supabase client cannot connect to the authentication service. Common causes:

1. **Missing Environment Variables**
   - `NEXT_PUBLIC_SUPABASE_URL` not set
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` not set

2. **Invalid Configuration**
   - Supabase URL format is incorrect
   - Supabase anon key is invalid or expired

3. **Network Issues**
   - CORS errors
   - Network connectivity problems
   - Firewall blocking Supabase requests

4. **Supabase Service Issues**
   - Supabase service is down
   - Rate limiting
   - Invalid project configuration

## Diagnostic Steps

### 1. Check Connection Endpoint

Visit the diagnostic endpoint:
```
https://ovrsee.ai/api/auth/check-connection
```

This will show:
- Whether environment variables are set
- Whether Supabase client can be created
- Whether connection to Supabase works
- Specific error messages

### 2. Check Configuration Endpoint

Visit:
```
https://ovrsee.ai/api/auth/check-config
```

This shows:
- Current Supabase URL (masked)
- Cookie configuration
- Session status

### 3. Check Browser Console

Open browser DevTools (F12) and check:
- Network tab for failed requests to Supabase
- Console tab for error messages
- Look for CORS errors or network failures

### 4. Check Server Logs

Check your deployment platform logs (Vercel, etc.) for:
- Environment variable errors
- Supabase connection errors
- Network errors

## Fixes

### Fix 1: Verify Environment Variables

Ensure these are set in your production environment:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://auth.ovrsee.ai
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**For Vercel:**
1. Go to Project Settings → Environment Variables
2. Verify both variables are set
3. Redeploy if you just added them

### Fix 2: Check Supabase URL

The Supabase URL should be:
- Your custom domain: `https://auth.ovrsee.ai` (if configured)
- Or your Supabase project URL: `https://xxxxx.supabase.co`

Verify in Supabase Dashboard → Settings → API

### Fix 3: Check CORS Configuration

In Supabase Dashboard:
1. Go to Settings → API
2. Check "Allowed Origins"
3. Ensure your domain is listed:
   - `https://ovrsee.ai`
   - `https://www.ovrsee.ai` (if using www)

### Fix 4: Check Network Connectivity

If on a corporate network or behind a firewall:
- Verify Supabase domains are not blocked
- Check if proxy settings are needed
- Test from a different network

### Fix 5: Verify Supabase Project Status

1. Check Supabase Dashboard for service status
2. Verify project is active and not paused
3. Check for any rate limiting or quota issues

## Improved Error Handling

The code now:
- ✅ Logs detailed error information to console
- ✅ Catches network errors (ECONNREFUSED, ENOTFOUND)
- ✅ Provides better error messages
- ✅ Includes connection diagnostic endpoint

## Testing

After applying fixes:

1. **Test Connection:**
   ```
   GET /api/auth/check-connection
   ```
   Should return `canConnect: true`

2. **Test Login:**
   - Try logging in with email/password
   - Check browser console for detailed errors
   - Verify session is created

3. **Test OAuth:**
   - Try Google OAuth login
   - Verify redirect works
   - Check session persistence

## Common Error Patterns

### "Missing required Supabase environment variables"
- **Cause:** Environment variables not set
- **Fix:** Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### "Invalid API key"
- **Cause:** Wrong or expired anon key
- **Fix:** Get correct key from Supabase Dashboard → Settings → API

### "Failed to fetch"
- **Cause:** Network/CORS issue
- **Fix:** Check CORS settings in Supabase, verify network connectivity

### "ECONNREFUSED" or "ENOTFOUND"
- **Cause:** Cannot reach Supabase servers
- **Fix:** Check network, firewall, DNS

## Related Files

- `lib/supabaseClient.ts` - Supabase client initialization
- `components/modals/AuthModal.tsx` - Login form and error handling
- `app/api/auth/check-connection/route.ts` - Connection diagnostic endpoint
- `app/api/auth/check-config/route.ts` - Configuration diagnostic endpoint

## Next Steps

1. Visit `/api/auth/check-connection` to diagnose the issue
2. Check environment variables in your deployment platform
3. Verify Supabase CORS settings
4. Check browser console for detailed error messages
5. Review server logs for connection errors



