# Google OAuth "Client Not Found" Troubleshooting Guide

## Error: "The OAuth client was not found" (Error 401: invalid_client)

This error means Google cannot find the OAuth client ID you're using. Here's how to fix it:

## Step-by-Step Fix

### 1. Verify Client ID in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Make sure you're in the **correct Google Cloud project**
3. Find your OAuth 2.0 Client ID
4. **Copy the EXACT Client ID** (it should look like: `xxxxx-xxxxx.apps.googleusercontent.com`)

### 2. Compare with .env.local

Your current Client ID in `.env.local`:
```
1077385431224-vn2b4p0jl1gqs1gm7eubj0egephtt610.apps.googleusercontent.com
```

**Action:** Verify this EXACT string exists in Google Cloud Console. If it doesn't match:
- Either update `.env.local` with the correct Client ID from Google Cloud Console
- Or verify you're looking at the correct OAuth client

### 3. Check Redirect URI Match

The redirect URI must match **EXACTLY** (case-sensitive, no trailing slash):

**In Google Cloud Console, add:**
```
http://localhost:3000/api/sync/google/callback
```

**Common mistakes:**
- ❌ `http://localhost:3000/api/sync/google/callback/` (trailing slash)
- ❌ `http://localhost:3000/api/sync/google/callback ` (trailing space)
- ❌ `https://localhost:3000/api/sync/google/callback` (https instead of http)
- ✅ `http://localhost:3000/api/sync/google/callback` (correct)

### 4. Verify OAuth Client Settings

In Google Cloud Console, ensure:
- ✅ **Application type:** Web application
- ✅ **Name:** Any name (e.g., "OVRSEE Sync")
- ✅ **Authorized redirect URIs:** Contains exactly `http://localhost:3000/api/sync/google/callback`
- ✅ **Client is enabled** (not disabled or deleted)

### 5. Check OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Ensure the consent screen is configured
3. If testing, you can use "Testing" mode and add your email as a test user
4. If publishing, ensure it's published

### 6. Verify APIs are Enabled

1. Go to: https://console.cloud.google.com/apis/library
2. Search for and enable:
   - ✅ **Gmail API**
   - ✅ **Google Calendar API**

### 7. Common Issues

#### Issue: Client ID doesn't exist
**Solution:** Create a new OAuth 2.0 Client ID in Google Cloud Console

#### Issue: Wrong Google Cloud Project
**Solution:** Make sure you're using credentials from the same project where you added the redirect URI

#### Issue: Client was deleted/recreated
**Solution:** If you recreated the OAuth client, update `.env.local` with the new Client ID and Secret

#### Issue: Redirect URI mismatch
**Solution:** Copy the exact redirect URI from the error or check-config endpoint and add it to Google Cloud Console

### 8. Test Configuration

After making changes:

1. **Restart your dev server:**
   ```bash
   # Stop server (Ctrl+C) and restart
   npm run dev
   ```

2. **Check configuration:**
   Visit: http://localhost:3000/api/sync/google/check-config
   
   This will show you:
   - If Client ID is set
   - If Client Secret is set
   - What redirect URI is being used
   - Any configuration issues

3. **Try connecting again:**
   Go to Sync page and click "Connect Gmail"

### 9. Still Not Working?

If you've verified everything above and it still doesn't work:

1. **Create a NEW OAuth client:**
   - Go to Google Cloud Console → Credentials
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Type: Web application
   - Name: OVRSEE Sync (or any name)
   - Authorized redirect URIs: `http://localhost:3000/api/sync/google/callback`
   - Click "Create"
   - Copy the NEW Client ID and Client Secret

2. **Update .env.local:**
   ```bash
   GOOGLE_CLIENT_ID=your_new_client_id_here
   GOOGLE_CLIENT_SECRET=your_new_client_secret_here
   GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3000/api/sync/google/callback
   ```

3. **Restart dev server**

4. **Try again**

## Quick Diagnostic

Run this to check your configuration:
```bash
node scripts/check-google-oauth.js
```

This will show you:
- What Client ID is configured
- What redirect URI is being used
- Any configuration issues


