# Fix Gmail Connection - "invalid_client" Error

## Quick Fix Steps

The error "Error 401: invalid_client" means the redirect URI in your code doesn't match what's configured in Google Cloud Console.

### Step 1: Update .env.local

Open `.env.local` and make sure you have:

```bash
GMAIL_CLIENT_ID=1077385431224-vn2b4p0jl1gqs1gm7eubj0egephtt610.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=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
GMAIL_REDIRECT_URI=http://localhost:3001/api/gmail/callback
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

**Important:** 
- Uncomment `GMAIL_REDIRECT_URI` if it's commented
- Make sure the port is **3001** (not 3000)
- No trailing slash on the redirect URI

### Step 2: Update Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID (the one with Client ID starting with `1077385431224-`)
3. Scroll down to **"Authorized redirect URIs"**
4. Check if this EXACT URI is listed:
   ```
   http://localhost:3001/api/gmail/callback
   ```
5. **If it's missing or different:**
   - Click **"+ ADD URI"**
   - Paste: `http://localhost:3001/api/gmail/callback`
   - **Make sure there's NO trailing slash**
   - Click **"SAVE"**

### Step 3: Verify OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Make sure:
   - Publishing status is **"Testing"** (for development)
   - Your email (`nusecmdr@gmail.com`) is added as a **Test user**
   - If you're using a different email, add it as a test user

### Step 4: Restart Your Server

After updating `.env.local`, you **MUST** restart your Next.js server:

```bash
# Stop the server (Ctrl+C)
npm run dev
```

Environment variables are only loaded when the server starts!

### Step 5: Test the Configuration

Visit this URL to see your current configuration:
```
http://localhost:3001/api/gmail/test
```

This will show:
- Whether Client ID is set correctly
- What redirect URI is being used
- Any configuration issues

### Step 6: Try Connecting Again

1. Go to: http://localhost:3001/sync
2. Click "Connect Gmail"
3. You should be redirected to Google's OAuth page
4. Sign in with your Google account
5. Grant permissions

## Common Mistakes

1. **Wrong port**: Using `3000` instead of `3001` in redirect URI
2. **Trailing slash**: `http://localhost:3001/api/gmail/callback/` (has trailing slash) ❌
3. **HTTPS instead of HTTP**: Using `https://localhost:3001` (should be `http://` for localhost) ❌
4. **Different redirect URI**: Not matching exactly what's in Google Cloud Console
5. **Server not restarted**: Environment variables not loaded
6. **Wrong email**: Not added as test user in OAuth consent screen

## Verification Checklist

- [ ] `GMAIL_REDIRECT_URI=http://localhost:3001/api/gmail/callback` in `.env.local` (uncommented)
- [ ] No trailing slash on redirect URI
- [ ] Using `http://` not `https://` for localhost
- [ ] Port is `3001` not `3000`
- [ ] Redirect URI in Google Cloud Console matches exactly: `http://localhost:3001/api/gmail/callback`
- [ ] Server restarted after updating `.env.local`
- [ ] Email added as test user in OAuth consent screen
- [ ] Gmail API is enabled in the project

## Still Not Working?

1. **Double-check the redirect URI** in Google Cloud Console - it must match EXACTLY
2. **Check browser console** for any additional error messages
3. **Clear browser cache and cookies** for localhost
4. **Try in an incognito window** to rule out browser issues
5. **Verify you're signed into the correct Google account** in your browser
6. **Check the test endpoint**: http://localhost:3001/api/gmail/test

## Need More Help?

- See `TROUBLESHOOTING_GMAIL.md` for more detailed troubleshooting
- See `GMAIL_SETUP.md` for complete setup instructions
- Check the debug endpoint: http://localhost:3001/api/gmail/check-config




