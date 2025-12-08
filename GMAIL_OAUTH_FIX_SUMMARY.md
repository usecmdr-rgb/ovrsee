# Gmail OAuth Configuration Fix Summary

## Changes Made

### 1. Enhanced OAuth Redirect URI Helper (`lib/oauth-helpers.ts`)
- ✅ Now uses `getBaseUrl()` helper for consistent environment-aware URL resolution
- ✅ Added comprehensive documentation explaining the distinction between Supabase Google login and Gmail OAuth
- ✅ Added Google Cloud Console setup checklist in comments
- ✅ Improved fallback logic to use `getBaseUrl()` instead of hardcoded defaults

### 2. Strict Environment Variable Validation (`app/api/gmail/auth/route.ts`)
- ✅ Added `getGmailClientId()` and `getGmailClientSecret()` functions that fail loudly if missing
- ✅ Validates format (length, placeholder detection)
- ✅ Clear error messages pointing to setup instructions
- ✅ Enhanced debug logging (client ID length, format validation) without exposing secrets
- ✅ Added comprehensive documentation header explaining:
  - Separation from Supabase Google login
  - Google Cloud Console setup checklist
  - Required scopes (gmail.readonly, gmail.modify)

### 3. Improved Callback Error Handling (`app/api/gmail/callback/route.ts`)
- ✅ Uses `getBaseUrl()` for consistent redirects
- ✅ Better error messages for common OAuth errors (invalid_client, invalid_grant, etc.)
- ✅ Enhanced logging for debugging (without exposing secrets)
- ✅ Clear distinction between different error types
- ✅ Proper error propagation to UI with helpful messages

### 4. Enhanced Gmail Client (`lib/gmail/client.ts`)
- ✅ Added validation for OAuth credentials in token refresh
- ✅ Clear error messages if credentials are missing or placeholders
- ✅ Documentation explaining separation from Supabase auth

### 5. Improved UI Error Messages (`app/sync/page.tsx`)
- ✅ Enhanced error handling for `invalid_client` errors
- ✅ Clear explanation that Gmail OAuth is separate from Supabase Google login
- ✅ Step-by-step fix instructions for common errors

## Key Points

### Supabase Google Login vs Gmail OAuth
- **Supabase Google Login**: Uses Supabase's OAuth client (configured in Supabase dashboard)
  - Used for user authentication
  - Handled by Supabase automatically
  
- **Gmail OAuth**: Uses `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET` (configured in Google Cloud Console)
  - Used for Gmail API access (reading/sending emails)
  - Requires separate OAuth client in Google Cloud Console
  - These are **two different OAuth clients** and should NOT be mixed

### Environment Variables Required

```bash
# Gmail OAuth (separate from Supabase)
GMAIL_CLIENT_ID=<your_client_id_from_google_cloud>
GMAIL_CLIENT_SECRET=<your_client_secret_from_google_cloud>

# Optional: Override redirect URI (defaults to NEXT_PUBLIC_APP_URL/api/gmail/callback)
# GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback

# App URL (used for redirect URI construction)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or https://ovrsee.ai in production
```

### Google Cloud Console Setup

1. Go to: https://console.cloud.google.com/apis/credentials
2. Create or select OAuth 2.0 Client ID
3. Application type: **"Web application"**
4. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/gmail/callback` (or port from `NEXT_PUBLIC_APP_URL`)
   - Production: `https://ovrsee.ai/api/gmail/callback`
5. Enable Gmail API (APIs & Services → Library → Gmail API → Enable)
6. Copy Client ID and Client Secret
7. Set in `.env.local`
8. Restart dev server

### Redirect URI Requirements

- Must match **EXACTLY** between:
  - Code (uses `getOAuthRedirectUri()` helper)
  - Google Cloud Console (Authorized redirect URIs)
- No trailing slashes
- Correct protocol (`http://` for localhost, `https://` for production)
- Correct port (from `NEXT_PUBLIC_APP_URL`)

## Testing Instructions

1. **Set environment variables** in `.env.local`:
   ```bash
   GMAIL_CLIENT_ID=<your_actual_client_id>
   GMAIL_CLIENT_SECRET=<your_actual_client_secret>
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

2. **Restart dev server**:
   ```bash
   npm run dev
   ```

3. **Verify configuration**:
   - Visit: `http://localhost:3000/api/gmail/check-config`
   - Should show: Client ID configured, redirect URI, no issues

4. **Test connection**:
   - Go to: `http://localhost:3000/sync`
   - Click "Connect Gmail"
   - Should redirect to Google OAuth consent screen
   - No `invalid_client` error
   - After authorizing, should redirect back to `/sync?gmail_connected=true`

5. **Verify emails load**:
   - After connecting, emails should appear in the email queue
   - Click refresh icon to trigger sync

## Error Debugging

### Common Errors and Fixes

1. **"Error 401: invalid_client"**
   - Check: Client ID exists in Google Cloud Console
   - Check: Redirect URI matches exactly (no trailing slash, correct port)
   - Check: `GMAIL_CLIENT_ID` in `.env.local` matches Google Cloud Console
   - Fix: Update redirect URI in Google Cloud Console or fix `NEXT_PUBLIC_APP_URL`

2. **"Gmail OAuth is not configured"**
   - Check: `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` are set in `.env.local`
   - Check: No placeholder values (`your_gmail_client_id_here`)
   - Fix: Set actual values from Google Cloud Console and restart server

3. **"Redirect URI mismatch"**
   - Check: Visit `/api/gmail/check-config` to see current redirect URI
   - Check: This exact URI is in Google Cloud Console
   - Fix: Add the redirect URI to Google Cloud Console or update `NEXT_PUBLIC_APP_URL`

4. **"Token exchange failed"**
   - Check: Authorization code might have expired (try again)
   - Check: Redirect URI used in callback matches auth request
   - Fix: Ensure `getOAuthRedirectUri()` is used consistently

## Debug Endpoints

- `/api/gmail/check-config` - JSON diagnostic endpoint
- `/api/gmail/test` - HTML diagnostic page
- `/api/gmail/debug` - Additional debug info

## Files Modified

1. `lib/oauth-helpers.ts` - Enhanced redirect URI helper
2. `app/api/gmail/auth/route.ts` - Strict validation, better logging
3. `app/api/gmail/callback/route.ts` - Improved error handling
4. `lib/gmail/client.ts` - Enhanced validation
5. `app/sync/page.tsx` - Improved error messages

## Next Steps

1. Test the connection flow end-to-end
2. Verify redirect URI matches Google Cloud Console
3. Ensure environment variables are set correctly
4. Check that errors are displayed clearly in the UI




