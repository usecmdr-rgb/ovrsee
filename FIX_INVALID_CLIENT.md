# Fix: "Error 401: invalid_client" - OAuth Client Not Found

## What This Error Means

Google cannot find the OAuth client with the Client ID you're using. This usually means:

1. **The Client ID doesn't exist** in Google Cloud Console
2. **The Client ID is from a different project**
3. **The Client ID was deleted**
4. **There's a typo in the Client ID**

## Step-by-Step Fix

### Step 1: Verify Your Client ID in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Make sure you're in the **correct project** (the one where you created the OAuth client)
3. Find your OAuth 2.0 Client ID in the list
4. Click on it to open details
5. **Copy the Client ID** shown (it should be a long string like: `1077385431224-xxxxx.apps.googleusercontent.com`)

### Step 2: Verify Client ID in Your Code

Check what Client ID is in your `.env.local`:

```bash
cat .env.local | grep GMAIL_CLIENT_ID
```

It should show:
```
GMAIL_CLIENT_ID=1077385431224-vn2b4p0jl1gqs1gm7eubj0egephtt610.apps.googleusercontent.com
```

### Step 3: Compare and Fix

**If they DON'T match:**

1. Copy the Client ID from Google Cloud Console
2. Open `.env.local` in your project
3. Replace the `GMAIL_CLIENT_ID` value with the correct one:
   ```
   GMAIL_CLIENT_ID=your_actual_client_id_from_google_cloud_console
   ```
4. **Also update the Client Secret** if needed:
   ```
   GMAIL_CLIENT_SECRET=your_actual_client_secret_from_google_cloud_console
   ```
5. **Save the file**
6. **Restart your dev server:**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

### Step 4: If Client ID Doesn't Exist - Create New One

If you can't find the Client ID in Google Cloud Console:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. If prompted, configure OAuth consent screen first
4. Application type: **"Web application"**
5. Name: "OVRSEE Gmail Client"
6. **Authorized redirect URIs:** Add:
   ```
   http://localhost:3001/api/gmail/callback
   ```
7. Click **"CREATE"**
8. **Copy the Client ID and Client Secret** (you won't see the secret again!)
9. Update `.env.local` with the new credentials
10. Restart your dev server

### Step 5: Verify Everything

1. Visit: `http://localhost:3001/api/gmail/test`
2. Check that:
   - Client ID shows as "Configured"
   - Redirect URI is: `http://localhost:3001/api/gmail/callback`
3. Try connecting Gmail again

## Common Issues

### Issue: "I can't find my OAuth client"
- Make sure you're in the correct Google Cloud project
- Check if you have multiple projects - the Client ID might be in a different one
- The Client ID might have been deleted - create a new one

### Issue: "Client ID exists but still getting error"
- Make sure there are no extra spaces in `.env.local`
- Make sure the Client ID is on one line (no line breaks)
- Restart your dev server after updating `.env.local`

### Issue: "Different email account"
- The error shows `usecmdr@gmail.com` but you might be using a different Google account
- Make sure you're signed into the correct Google account in your browser
- Or update the test user in OAuth consent screen to include `usecmdr@gmail.com`

## Quick Verification Commands

```bash
# Check current Client ID
cat .env.local | grep GMAIL_CLIENT_ID

# Test the configuration
curl http://localhost:3001/api/gmail/debug
```

## Still Not Working?

1. **Double-check the Client ID** - copy it directly from Google Cloud Console
2. **Check for typos** - even one wrong character will fail
3. **Verify the project** - make sure you're using credentials from the same project
4. **Create a new OAuth client** if the old one is causing issues
5. **Clear browser cache** and try again

