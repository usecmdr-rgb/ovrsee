# Fix: "OAuth client was not found" Error

## Your Current Configuration
- **Client ID**: `1077385431224-vn2b4p0jl1gqs1gm7eubj0egephtt610.apps.googleusercontent.com`
- **Redirect URI**: `http://localhost:3000/api/sync/google/callback`
- **Project Number**: `1077385431224`

## Quick Fix Checklist

### Step 1: Verify Client ID Exists
1. Go to: https://console.cloud.google.com/apis/credentials
2. Check the project dropdown at the top - make sure it shows project `1077385431224`
3. Look for "OAuth 2.0 Client IDs" section
4. **Find the Client ID**: `1077385431224-vn2b4p0jl1gqs1gm7eubj0egephtt610.apps.googleusercontent.com`
5. **If it doesn't exist** → Go to Step 2 (Create New)
6. **If it exists** → Go to Step 3 (Verify Configuration)

### Step 2: Create a NEW OAuth Client (If Missing)

1. **Go to**: https://console.cloud.google.com/apis/credentials
2. **Click**: "Create Credentials" → "OAuth client ID"
3. **If prompted**: Configure OAuth consent screen first (set to Testing mode)
4. **Application type**: Select "Web application"
5. **Name**: `OVRSEE Sync OAuth Client`
6. **Authorized redirect URIs**: Click "Add URI" and enter:
   ```
   http://localhost:3000/api/sync/google/callback
   ```
   **IMPORTANT**: 
   - No trailing slash
   - Exact match: `http://localhost:3000/api/sync/google/callback`
   - Case-sensitive
7. **Click**: "Create"
8. **Copy** the Client ID and Client Secret
9. **Update** `.env.local`:
   ```bash
   GOOGLE_CLIENT_ID=your-new-client-id-here
   GOOGLE_CLIENT_SECRET=your-new-client-secret-here
   ```
10. **Restart** your dev server: `npm run dev`

### Step 3: Verify Existing Client Configuration

If the Client ID exists, verify these settings:

#### A. Check Redirect URI
1. Click on your OAuth client to edit it
2. Scroll to "Authorized redirect URIs"
3. **Verify** this URI exists EXACTLY:
   ```
   http://localhost:3000/api/sync/google/callback
   ```
4. **Common mistakes**:
   - ❌ `http://localhost:3000/api/sync/google/callback/` (trailing slash)
   - ❌ `https://localhost:3000/api/sync/google/callback` (https instead of http)
   - ❌ `http://localhost:3001/api/sync/google/callback` (wrong port)
   - ❌ Missing the URI entirely

#### B. Check Client Status
1. Make sure the OAuth client shows **"Enabled"** status
2. If it's disabled, click "Enable"

#### C. Check OAuth Consent Screen
1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. **Publishing status**: Should be "Testing"
3. **Test users**: Add `usecmdr@gmail.com` (or your email)
4. **Scopes**: Should include:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/calendar`

#### D. Check Project
1. Verify you're in the correct Google Cloud project
2. Project number should match: `1077385431224`
3. If you're in the wrong project, switch to the correct one

### Step 4: After Making Changes

1. **Update** `.env.local` if you created a new client
2. **Restart** your Next.js dev server:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```
3. **Clear browser cache/cookies** for localhost
4. **Try connecting again**

## Most Common Issue: Redirect URI Mismatch

**90% of "OAuth client was not found" errors are caused by redirect URI mismatch.**

The redirect URI in Google Cloud Console **MUST** match exactly:
- ✅ `http://localhost:3000/api/sync/google/callback`
- ❌ `http://localhost:3000/api/sync/google/callback/` (trailing slash)
- ❌ `https://localhost:3000/api/sync/google/callback` (https)
- ❌ `http://127.0.0.1:3000/api/sync/google/callback` (different host)

## Still Not Working?

If you've verified everything and it still doesn't work:

1. **Create a completely new OAuth client** (fresh start)
2. **Double-check** the Client ID is copied correctly (no extra spaces)
3. **Verify** the redirect URI matches character-for-character
4. **Make sure** you're in the correct Google Cloud project
5. **Check** that Gmail API and Calendar API are enabled:
   - https://console.cloud.google.com/apis/library/gmail.googleapis.com
   - https://console.cloud.google.com/apis/library/calendar-json.googleapis.com

## Quick Test

After updating, test the OAuth URL generation:

```bash
node scripts/test-oauth-url.js
```

This will show you the exact OAuth URL being generated, which you can compare with what Google expects.


