# Fix: redirect_uri_mismatch Error

## The Problem
When clicking "Continue with Google", you're getting:
```
Error 400: redirect_uri_mismatch
```

This means the redirect URI Supabase is sending to Google doesn't match what's configured in your Google Cloud Console.

## The Solution

### Step 1: Get Your Supabase Callback URL
Your Supabase callback URL is:
```
https://nupxbdbychuqokubresi.supabase.co/auth/v1/callback
```

### Step 2: Add to Google Cloud Console
1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth client (CommanderX)
3. Scroll to **"Authorized redirect URIs"**
4. Click **"+ ADD URI"**
5. Add this EXACT URL (copy-paste to avoid typos):
   ```
   https://nupxbdbychuqokubresi.supabase.co/auth/v1/callback
   ```
6. Click **"SAVE"**

### Step 3: Verify All Redirect URIs
Make sure you have ALL of these in your Google Cloud Console:

1. **For Supabase Google Sign-In:**
   ```
   https://nupxbdbychuqokubresi.supabase.co/auth/v1/callback
   ```

2. **For Gmail API (Local Dev):**
   ```
   http://localhost:3001/api/gmail/callback
   ```

3. **For Gmail API (Production):**
   ```
   https://ovrsee.ai/api/gmail/callback
   ```

## Important Notes

- **Exact match required**: The URL must match EXACTLY, including:
  - Protocol: `https://` (not `http://`)
  - No trailing slash
  - Exact domain and path
- **Case sensitive**: URLs are case-sensitive
- **No wildcards**: Google doesn't support wildcards in redirect URIs

## After Adding

1. Wait a few seconds for Google to update
2. Try "Continue with Google" again
3. It should work now!

## Troubleshooting

If it still doesn't work:
1. Double-check the URL is exactly: `https://nupxbdbychuqokubresi.supabase.co/auth/v1/callback`
2. Make sure you clicked "SAVE" in Google Cloud Console
3. Clear your browser cache and try again
4. Try in an incognito/private window



