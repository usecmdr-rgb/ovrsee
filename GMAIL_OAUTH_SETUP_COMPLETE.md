# Gmail OAuth Setup - Complete Configuration

## ✅ Configuration Complete

The Gmail OAuth client is now properly wired into the app with:

1. ✅ **Standardized Environment Variables**
   - Uses `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` (separate from Supabase)
   - Strict validation with clear error messages if missing

2. ✅ **Environment-Aware Redirect URI**
   - Uses `getBaseUrl()` helper for consistent URL resolution
   - Constructs: `${getBaseUrl()}/api/gmail/callback`
   - Works for both development and production

3. ✅ **Comprehensive Setup Instructions**
   - Added detailed comments in code with specific values
   - Google Cloud Console checklist included

4. ✅ **Improved Error Handling**
   - Clear error messages for common OAuth errors
   - User-friendly frontend error display
   - Detailed server-side logging (without exposing secrets)

## Required Environment Variables

Add these to your `.env.local`:

```bash
# Gmail OAuth Client (separate from Supabase Google login)
GMAIL_CLIENT_ID=1077385431224-armgjmsn38f1mj23m5l1q8j274ch80p2.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=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

# App URL (used for redirect URI construction)
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Or for port 3001:
# NEXT_PUBLIC_APP_URL=http://localhost:3001

# Optional: Override redirect URI explicitly
# GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback
```

## Google Cloud Console Setup

1. **Go to**: https://console.cloud.google.com/apis/credentials

2. **Create or select OAuth 2.0 Client ID**
   - Application type: **"Web application"**

3. **Enable Gmail API**
   - Go to APIs & Services → Library
   - Search for "Gmail API"
   - Click "Enable"

4. **Add Authorized Redirect URIs** (EXACT match required, no trailing slashes):
   - Development: `http://localhost:3000/api/gmail/callback`
     (or `http://localhost:3001/api/gmail/callback` if using port 3001)
   - Production: `https://ovrsee.ai/api/gmail/callback`

5. **Copy Credentials**
   - Client ID: `1077385431224-armgjmsn38f1mj23m5l1q8j274ch80p2.apps.googleusercontent.com`
   - Client Secret: `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`

6. **Set in `.env.local`** (see above)

7. **Restart dev server** (env vars only load on server start)

## Testing Instructions

### Step 1: Verify Configuration

Visit the diagnostic endpoint:
```
http://localhost:3000/api/gmail/check-config
```

Should show:
- ✅ Client ID configured (length: ~80+ characters)
- ✅ Client Secret configured
- ✅ Redirect URI: `http://localhost:3000/api/gmail/callback`
- ✅ No issues

### Step 2: Test Connection Flow

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Go to Sync page**:
   ```
   http://localhost:3000/sync
   ```

3. **Click "Connect Gmail"**:
   - Should redirect to Google OAuth consent screen
   - Should show Gmail scopes (gmail.readonly, gmail.modify)
   - Should NOT show "Error 401: invalid_client"

4. **Authorize Gmail access**:
   - After accepting, should redirect to `/api/gmail/callback`
   - Should exchange code for tokens
   - Should store tokens in `gmail_connections` table
   - Should redirect back to `/sync?gmail_connected=true`

5. **Verify emails load**:
   - After connecting, emails should appear in the email queue
   - Click refresh icon to trigger sync
   - Gmail messages should load

### Step 3: Verify Token Storage

Check that tokens are stored:
- In Supabase: `gmail_connections` table
- Should have: `access_token`, `refresh_token`, `expires_at`
- User ID should match the logged-in user

## Troubleshooting

### Error: "Error 401: invalid_client"

**Causes:**
1. Client ID doesn't exist in Google Cloud Console
2. Redirect URI doesn't match exactly
3. Wrong OAuth client (using Supabase's instead of Gmail's)

**Fix:**
1. Verify Client ID in Google Cloud Console matches `.env.local`
2. Check redirect URI matches exactly (visit `/api/gmail/check-config`)
3. Ensure you're using the Gmail OAuth client, not Supabase's

### Error: "Redirect URI mismatch"

**Causes:**
1. Redirect URI in code doesn't match Google Cloud Console
2. Wrong port (3000 vs 3001)
3. Trailing slash or protocol mismatch

**Fix:**
1. Visit `/api/gmail/check-config` to see current redirect URI
2. Add this EXACT URI to Google Cloud Console
3. Ensure `NEXT_PUBLIC_APP_URL` matches your dev server port

### Error: "Gmail OAuth is not configured"

**Causes:**
1. `GMAIL_CLIENT_ID` or `GMAIL_CLIENT_SECRET` missing in `.env.local`
2. Placeholder values still present
3. Server not restarted after updating env vars

**Fix:**
1. Check `.env.local` has actual values (not placeholders)
2. Restart dev server: `npm run dev`
3. Verify with `/api/gmail/check-config`

## Code Locations

- **OAuth Authorization**: `app/api/gmail/auth/route.ts`
- **OAuth Callback**: `app/api/gmail/callback/route.ts`
- **Redirect URI Helper**: `lib/oauth-helpers.ts`
- **Gmail Client**: `lib/gmail/client.ts`
- **UI Connection Flow**: `app/sync/page.tsx` (handleConnectGmail function)

## Key Points

1. **Separate from Supabase**: Gmail OAuth uses different credentials than Supabase Google login
2. **Exact Match Required**: Redirect URI must match exactly between code and Google Cloud Console
3. **Environment Aware**: Uses `getBaseUrl()` for consistent URL resolution
4. **Strict Validation**: Fails loudly if env vars are missing or invalid
5. **Clear Errors**: User-friendly error messages with actionable fixes

## Success Criteria

✅ No "invalid_client" error when clicking "Connect Gmail"  
✅ Google OAuth consent screen appears  
✅ After authorization, redirects to `/api/gmail/callback` successfully  
✅ Tokens stored in `gmail_connections` table  
✅ Redirects back to `/sync?gmail_connected=true`  
✅ Gmail emails appear in the email queue after refresh




