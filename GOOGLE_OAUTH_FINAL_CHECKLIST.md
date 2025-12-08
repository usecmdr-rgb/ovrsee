# Google OAuth Final Checklist

## ✅ What's Working
- Gmail API is **Enabled** (confirmed from your screenshot)
- Client ID is configured correctly in `.env.local`
- Redirect URI is configured correctly in `.env.local`

## ⚠️ What to Check Next

### 1. Enable Google Calendar API

Since you're using both Gmail and Calendar, you need to enable Calendar API:

1. Go to: https://console.cloud.google.com/apis/library
2. Search for: **"Google Calendar API"**
3. Click on it
4. Click **"Enable"** button
5. Wait for it to enable

### 2. Verify OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Check:
   - ✅ Consent screen is configured
   - ✅ Publishing status: "Testing" or "In production"
   - ✅ If "Testing": Add your email (`usecmdr@gmail.com`) as a test user
   - ✅ Scopes include:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/calendar`

### 3. Double-Check OAuth Client Configuration

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on **"OVRSEE"** client (Nov 24)
3. Verify:
   - ✅ Client ID matches: `1077385431224-vn2b4p0jl1gqs1gm7eubj0egephtt610.apps.googleusercontent.com`
   - ✅ **"Authorized redirect URIs"** contains EXACTLY:
     ```
     http://localhost:3000/api/sync/google/callback
     ```
   - ✅ No trailing slash
   - ✅ Uses `http://` not `https://`
   - ✅ Port is `3000`
   - ✅ Client is **enabled** (not disabled)

### 4. Test the OAuth URL Directly

Copy this URL and paste it in your browser:
```
https://accounts.google.com/o/oauth2/v2/auth?client_id=1077385431224-vn2b4p0jl1gqs1gm7eubj0egephtt610.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fsync%2Fgoogle%2Fcallback&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.send+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar&access_type=offline&prompt=consent&state=test
```

**If you still get "OAuth client was not found":**
- The Client ID doesn't exist in Google Cloud Console
- OR the redirect URI doesn't match exactly

### 5. Common Issues

#### Issue: Redirect URI has trailing slash
**Wrong:** `http://localhost:3000/api/sync/google/callback/`  
**Correct:** `http://localhost:3000/api/sync/google/callback`

#### Issue: Using HTTPS instead of HTTP for localhost
**Wrong:** `https://localhost:3000/api/sync/google/callback`  
**Correct:** `http://localhost:3000/api/sync/google/callback`

#### Issue: OAuth consent screen not configured
**Solution:** Configure the consent screen and add yourself as a test user

#### Issue: Calendar API not enabled
**Solution:** Enable Google Calendar API in API Library

### 6. After Making Changes

1. **Save** all changes in Google Cloud Console
2. **Wait 5-10 minutes** for changes to propagate
3. **Restart dev server:**
   ```bash
   # Stop (Ctrl+C) and restart
   npm run dev
   ```
4. **Clear browser cache** or use incognito mode
5. **Try connecting again**

## Quick Test

Run this to verify your configuration:
```bash
node scripts/verify-google-oauth.js
```

This will show you exactly what's configured and generate a test OAuth URL.


