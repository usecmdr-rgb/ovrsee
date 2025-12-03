# Sync Google OAuth Troubleshooting

## Error: "Error 401: invalid_client - The OAuth client was not found"

This error means Google cannot find the OAuth client ID you're using. Here's how to fix it:

### Step 1: Check Your Configuration

Visit the diagnostic endpoint:
```
http://localhost:3000/api/sync/google/check-config
```

This will show you:
- Whether `GOOGLE_CLIENT_ID` is set
- Whether `GOOGLE_CLIENT_SECRET` is set  
- What redirect URI is being used
- Any configuration issues

### Step 2: Verify Environment Variables

Check your `.env.local` file has:

```env
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3000/api/sync/google/callback
```

**Important:** 
- The Client ID should end with `.apps.googleusercontent.com`
- The redirect URI must match EXACTLY what's in Google Cloud Console
- No trailing slashes, exact protocol (http vs https)

### Step 3: Verify Google Cloud Console Setup

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com/apis/credentials

2. **Check OAuth 2.0 Client IDs:**
   - Find your OAuth client (or create a new one)
   - Client type should be "Web application"
   - Copy the Client ID and Client Secret

3. **Verify Authorized Redirect URIs:**
   - Click on your OAuth client
   - Under "Authorized redirect URIs", ensure you have:
     ```
     http://localhost:3000/api/sync/google/callback
     ```
   - For production, also add:
     ```
     https://yourdomain.com/api/sync/google/callback
     ```
   - **Exact match required** - no trailing slashes, correct protocol

4. **Check OAuth Consent Screen:**
   - Go to: https://console.cloud.google.com/apis/credentials/consent
   - Ensure it's configured (at least "Testing" status)
   - Add your email as a test user if in testing mode

### Step 4: Common Issues

#### Issue 1: Client ID Not Set
**Symptom:** `GOOGLE_CLIENT_ID` shows "NOT SET" in check-config

**Fix:**
```bash
# Add to .env.local
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
```

#### Issue 2: Wrong Client ID Format
**Symptom:** Client ID doesn't end with `.apps.googleusercontent.com`

**Fix:** Copy the full Client ID from Google Cloud Console, including the `.apps.googleusercontent.com` suffix

#### Issue 3: Redirect URI Mismatch
**Symptom:** Error says "redirect_uri_mismatch"

**Fix:**
1. Check what redirect URI your app is using (from `/api/sync/google/check-config`)
2. Add that EXACT URI to Google Cloud Console
3. Common mistakes:
   - ❌ `http://localhost:3000/api/sync/google/callback/` (trailing slash)
   - ❌ `https://localhost:3000/api/sync/google/callback` (https instead of http)
   - ✅ `http://localhost:3000/api/sync/google/callback` (correct)

#### Issue 4: OAuth Client Not Found
**Symptom:** "Error 401: invalid_client - The OAuth client was not found"

**Possible causes:**
1. Client ID is incorrect (typo, wrong project)
2. Client was deleted from Google Cloud Console
3. Client ID is from a different Google Cloud project
4. Client type is wrong (should be "Web application", not "Desktop" or "iOS")

**Fix:**
1. Verify the Client ID in Google Cloud Console matches your `.env.local`
2. Create a new OAuth client if the old one was deleted
3. Ensure you're using the correct Google Cloud project

#### Issue 5: Using Legacy Gmail Variables
**Note:** The code supports both new and legacy env var names:
- New: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URL`
- Legacy: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`

If you have legacy variables set, they'll be used as fallback. However, for Sync (which includes Calendar), use the new `GOOGLE_*` variables.

### Step 5: Restart Dev Server

After updating `.env.local`:
```bash
# Stop the dev server (Ctrl+C)
# Then restart:
npm run dev
```

Environment variables are loaded at startup, so changes require a restart.

### Step 6: Test Again

1. Visit: `http://localhost:3000/api/sync/google/check-config`
2. Verify all checks pass
3. Get OAuth URL: `http://localhost:3000/api/sync/google/oauth-url?returnTo=%2Fsync`
4. Open the URL in browser
5. Should redirect to Google OAuth consent screen (not error page)

### Quick Checklist

- [ ] `GOOGLE_CLIENT_ID` is set in `.env.local`
- [ ] `GOOGLE_CLIENT_SECRET` is set in `.env.local`
- [ ] `GOOGLE_OAUTH_REDIRECT_URL` is set (or using default)
- [ ] Client ID ends with `.apps.googleusercontent.com`
- [ ] Redirect URI in Google Cloud Console matches exactly
- [ ] OAuth consent screen is configured
- [ ] Dev server restarted after env var changes
- [ ] `/api/sync/google/check-config` shows all green

### Still Having Issues?

1. **Check server logs** for detailed error messages
2. **Verify in Google Cloud Console:**
   - OAuth client exists
   - Client ID matches `.env.local`
   - Redirect URI is added
   - OAuth consent screen is published (or in testing with your email added)
3. **Try creating a new OAuth client** in Google Cloud Console
4. **Check browser console** for additional error details

### Example Working Configuration

```env
# .env.local
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz123456
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3000/api/sync/google/callback
```

In Google Cloud Console:
- **Authorized redirect URIs:**
  - `http://localhost:3000/api/sync/google/callback`
  - `https://yourdomain.com/api/sync/google/callback` (for production)



