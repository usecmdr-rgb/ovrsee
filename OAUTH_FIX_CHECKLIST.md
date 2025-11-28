# OAuth "Access Blocked" Fix Checklist

## ✅ Step 1: Verify Redirect URI (You've Done This)
- [x] Added `http://localhost:3001/api/gmail/callback` to Authorized redirect URIs

## ⚠️ Step 2: OAuth Consent Screen Configuration (CRITICAL!)

This is often the issue! You need to configure the OAuth consent screen:

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. If you haven't set it up:
   - Click "CONFIGURE CONSENT SCREEN"
   - Choose "External" (for testing)
   - Fill in:
     - App name: "OVRSEE" (or any name)
     - User support email: Your email
     - Developer contact: Your email
   - Click "SAVE AND CONTINUE"
3. **Add Scopes:**
   - Click "ADD OR REMOVE SCOPES"
   - Search for "Gmail"
   - Select:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.modify`
   - Click "UPDATE"
   - Click "SAVE AND CONTINUE"
4. **Add Test Users (REQUIRED!):**
   - Under "Test users", click "+ ADD USERS"
   - Add your email: `nematollah.cas@gmail.com`
   - Click "ADD"
   - Click "SAVE AND CONTINUE"
5. Click "BACK TO DASHBOARD"

## ✅ Step 3: Verify Redirect URI Format

Make sure in Google Cloud Console, the redirect URI is EXACTLY:
```
http://localhost:3001/api/gmail/callback
```

Check for:
- ❌ No trailing slash: `/api/gmail/callback/` (WRONG)
- ❌ Wrong port: `http://localhost:3000/...` (WRONG)
- ❌ HTTPS: `https://localhost:3001/...` (WRONG)
- ✅ Correct: `http://localhost:3001/api/gmail/callback` (CORRECT)

## ✅ Step 4: Verify Client ID Matches

1. In Google Cloud Console → Credentials
2. Click your OAuth 2.0 Client ID
3. Copy the Client ID shown
4. Verify it matches your `.env.local`:
   ```bash
   cat .env.local | grep GMAIL_CLIENT_ID
   ```
5. Should show: `GMAIL_CLIENT_ID=1077385431224-vn2b4p0jl1gqs1gm7eubj0egephtt610.apps.googleusercontent.com`

## ✅ Step 5: Check Publishing Status

In OAuth consent screen:
- For testing: Status should be "Testing"
- Your email MUST be in "Test users" list
- If status is "In production", you need to verify the app (not needed for testing)

## ✅ Step 6: Clear Browser Cache

Sometimes cached OAuth errors persist:
1. Clear browser cache and cookies for `accounts.google.com`
2. Try in an incognito/private window
3. Try a different browser

## ✅ Step 7: Verify Gmail API is Enabled

1. Go to: https://console.cloud.google.com/apis/library/gmail.googleapis.com
2. Make sure "Gmail API" shows "API enabled"
3. If not, click "ENABLE"

## Common Error Messages:

- **"Access blocked: Authorization Error"** → Usually OAuth consent screen not configured or test user not added
- **"Error 401: invalid_client"** → Client ID mismatch or redirect URI mismatch
- **"redirect_uri_mismatch"** → Redirect URI doesn't match exactly

## Quick Test:

Visit: `http://localhost:3001/api/gmail/test` to see your current configuration and the exact redirect URI being used.

