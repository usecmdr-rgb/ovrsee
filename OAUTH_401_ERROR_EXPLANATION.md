# Why You're Getting 401 "Missing Authentication Credential" Error

## The Problem

After completing the OAuth consent screen, Google redirects back to your app with an authorization code. Your app then:

1. ✅ **Exchanges the code for tokens** (this might be working)
2. ❌ **Tries to fetch user email** (this is failing with 401)

The 401 error means Google says: "I don't see a valid access token in your request."

## Why This Happens

### Most Likely Causes:

1. **Access Token is Null/Empty**
   - The token exchange might not be returning an `access_token`
   - The access token might be undefined or empty string
   - Check terminal logs for: `[Google OAuth] Token exchange successful:`

2. **Access Token Format is Wrong**
   - The token might be corrupted or malformed
   - The token might not be a valid JWT format

3. **Token Exchange Failed Silently**
   - The exchange might appear to succeed but return invalid data
   - Check if `data.access_token` actually exists in the response

4. **ID Token Not Being Used**
   - If ID token decode fails, it falls back to userinfo API
   - The userinfo API call might be using a null/empty access token

## What Should Happen

### Normal Flow:
```
1. User clicks "Connect Gmail"
   → Redirects to Google OAuth consent screen

2. User grants permissions
   → Google redirects to: /api/sync/google/callback?code=XXX&state=YYY

3. Your app exchanges code for tokens
   → Should get: access_token, id_token, refresh_token

4. Your app gets user email
   → Should use ID token (fastest) OR userinfo API (fallback)

5. Your app stores integration
   → Saves tokens to database

6. Redirects to /sync
   → User sees their connected Gmail
```

### What's Actually Happening:
```
1. ✅ User grants permissions
2. ✅ Google redirects with code
3. ❓ Token exchange (might be failing silently)
4. ❌ Getting user email fails with 401
5. ❌ Error shown instead of redirecting to /sync
```

## How to Debug

### Check Terminal Logs

After trying to connect, look for these log messages:

1. **Token Exchange:**
   ```
   [Google OAuth] Token exchange successful: {
     hasAccessToken: true/false  ← Should be TRUE
     accessTokenLength: 123      ← Should be > 0
     hasIdToken: true/false      ← Should be TRUE
   }
   ```

2. **ID Token Decode:**
   ```
   [Google OAuth] Attempting to decode ID token...
   [Google OAuth] ID token decoded successfully: {
     hasEmail: true/false        ← Should be TRUE
     email: "user@example.com"  ← Should show email
   }
   ```

3. **If ID Token Fails:**
   ```
   [Google OAuth] Failed to decode ID token, falling back to userinfo
   [Google OAuth] Fetching user info from Google API...
   [Google OAuth] Failed to fetch user info: {
     status: 401                 ← This is your error
     accessTokenLength: 0        ← If 0, token is missing!
   }
   ```

## Common Fixes

### Fix 1: Check Token Exchange Response

The token exchange might be returning an error. Check if you see:
- `Token exchange failed: No access token in response`
- This means Google didn't return an access token

**Possible causes:**
- Client secret is wrong
- Redirect URI mismatch
- Authorization code already used (codes are single-use)

### Fix 2: Verify Client Secret

Make sure `GOOGLE_CLIENT_SECRET` in `.env.local` matches Google Cloud Console exactly.

### Fix 3: Check Redirect URI

The redirect URI in the token exchange must match exactly:
- In `.env.local`: `http://localhost:3000/api/sync/google/callback`
- In Google Cloud Console: Must be EXACTLY the same (no trailing slash)

### Fix 4: Authorization Code Reuse

OAuth authorization codes can only be used once. If you:
- Try to connect multiple times
- Refresh the callback page
- The code becomes invalid

**Solution:** Start fresh - click "Connect Gmail" again from the beginning.

## Next Steps

1. **Restart your dev server** (to pick up any env var changes)
2. **Try connecting again** (start from the beginning, don't refresh callback page)
3. **Check terminal logs** for the detailed messages I added
4. **Share the logs** so we can see exactly what's happening

The enhanced logging will show us:
- Whether token exchange succeeds
- What tokens are received
- Why ID token decode might fail
- The exact error from Google API


