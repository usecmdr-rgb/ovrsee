# Fix OAuth Client After Deleting Duplicate

## Current Situation
- ✅ You're using: "OVRSEE" client (Nov 24, 2025)
- ✅ Client ID: `1077385431224-vn2b4p0jl1gqs1gm7eubj0egephtt610.apps.googleusercontent.com`
- ❌ The newer client was deleted (that's fine)

## Steps to Fix

### 1. Verify Redirect URI in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on **"OVRSEE"** client (the one from Nov 24)
3. Scroll to **"Authorized redirect URIs"** section
4. **Verify** this URI is in the list:
   ```
   http://localhost:3000/api/sync/google/callback
   ```
5. **If it's NOT there:**
   - Click "+ Add URI"
   - Add: `http://localhost:3000/api/sync/google/callback`
   - Click "Save"
   - **Wait 5-10 minutes** for changes to propagate

### 2. Verify OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Ensure:
   - ✅ Consent screen is configured
   - ✅ Publishing status is "Testing" or "In production"
   - ✅ If "Testing", add your email (`usecmdr@gmail.com`) as a test user
   - ✅ Scopes include:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/calendar`

### 3. Verify APIs are Enabled

1. Go to: https://console.cloud.google.com/apis/library
2. Search for and enable:
   - ✅ **Gmail API**
   - ✅ **Google Calendar API**

### 4. Verify .env.local Configuration

Your `.env.local` should have:
```bash
GOOGLE_CLIENT_ID=1077385431224-vn2b4p0jl1gqs1gm7eubj0egephtt610.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3000/api/sync/google/callback
AUTH_SECRET=b7e48577d2112d819d737e5753a59aec91583557d759fe58a89ea4192208afcb
```

### 5. Restart Dev Server

After making any changes:
```bash
# Stop server (Ctrl+C) and restart
npm run dev
```

### 6. Test Configuration

Visit: http://localhost:3000/api/sync/google/check-config

This will show you:
- ✅ If Client ID is set correctly
- ✅ If redirect URI matches
- ✅ Any configuration issues

### 7. Try Connecting Again

1. Go to: http://localhost:3000/sync
2. Click "Connect Gmail"
3. If you still get "OAuth client was not found":
   - Wait 5-10 more minutes (Google propagation delay)
   - Clear browser cache
   - Try in incognito/private window

## Common Issues

### Issue: Redirect URI mismatch
**Solution:** Make sure the URI in Google Cloud Console matches EXACTLY:
- ✅ `http://localhost:3000/api/sync/google/callback`
- ❌ NOT `http://localhost:3000/api/sync/google/callback/` (trailing slash)
- ❌ NOT `https://localhost:3000/api/sync/google/callback` (https)

### Issue: OAuth consent screen not configured
**Solution:** Configure the consent screen and add yourself as a test user

### Issue: APIs not enabled
**Solution:** Enable Gmail API and Calendar API in Google Cloud Console

## Still Not Working?

If after all these steps it still doesn't work:

1. **Double-check the Client ID:**
   - In Google Cloud Console, click "OVRSEE"
   - Copy the Client ID exactly
   - Compare with what's in `.env.local`
   - They must match EXACTLY

2. **Check for typos:**
   - Client ID format: `xxxxx-xxxxx.apps.googleusercontent.com`
   - Redirect URI: `http://localhost:3000/api/sync/google/callback`

3. **Wait longer:**
   - Google says changes can take "5 minutes to a few hours"
   - Try again after 30 minutes

4. **Create a fresh client:**
   - If nothing works, create a brand new OAuth client
   - Configure it from scratch with the redirect URI
   - Update `.env.local` with the new credentials


