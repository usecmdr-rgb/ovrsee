# Final Fix for "Error 401: invalid_client"

## The Problem

Even though your configuration looks correct, Google still can't find the OAuth client. This usually means:

1. **Wrong Google Cloud Project** - The Client ID is from a different project
2. **Client ID was deleted** - It no longer exists
3. **Project mismatch** - Environment variables point to wrong project

## Solution: Create a Fresh OAuth Client

Since the current one isn't working, let's create a brand new one:

### Step 1: Create New OAuth Client

1. Go to: https://console.cloud.google.com/apis/credentials
2. **Make sure you're in the correct project** (check dropdown at top)
3. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
4. If you see "OAuth consent screen" warning:
   - Click "CONFIGURE CONSENT SCREEN"
   - Choose "External"
   - App name: "OVRSEE"
   - Support email: your email
   - Click "SAVE AND CONTINUE"
   - **Add Scopes:**
     - Click "ADD OR REMOVE SCOPES"
     - Search "Gmail"
     - Select both Gmail scopes
     - Click "UPDATE" → "SAVE AND CONTINUE"
   - **Add Test User:**
     - Click "+ ADD USERS"
     - Add: `usecmdr@gmail.com`
     - Click "ADD" → "SAVE AND CONTINUE"
   - Click "BACK TO DASHBOARD"
5. Now create OAuth client:
   - Application type: **"Web application"**
   - Name: "OVRSEE Gmail Client"
   - **Authorized redirect URIs:** 
     ```
     http://localhost:3001/api/gmail/callback
     ```
   - Click **"CREATE"**
6. **IMPORTANT:** Copy the Client ID and Client Secret immediately!

### Step 2: Update .env.local

1. Open `.env.local` in your project
2. Replace with the NEW credentials:
   ```
   GMAIL_CLIENT_ID=your_new_client_id_here
   GMAIL_CLIENT_SECRET=your_new_client_secret_here
   ```
3. **Save the file**

### Step 3: Restart Server

```bash
# Stop server (Ctrl+C)
npm run dev
```

### Step 4: Test

1. Visit: `http://localhost:3001/api/gmail/test`
2. Should show new Client ID
3. Try connecting Gmail

## Alternative: Verify Current Client

If you want to keep the current Client ID, verify:

1. **Check Project:**
   - In Google Cloud Console, check the project name at the top
   - Make sure it's the project where you created the OAuth client
   - If you have multiple projects, the Client ID might be in a different one

2. **Verify Client Exists:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Look for Client ID: `1077385431224-vn2b4p0jl1gqs1gm7eubj0egephtt610`
   - If you DON'T see it, it was deleted or is in a different project

3. **Check OAuth Consent Screen:**
   - Go to: https://console.cloud.google.com/apis/credentials/consent
   - Must be configured
   - Must have `usecmdr@gmail.com` as test user
   - Must have Gmail scopes

## Quick Test Command

```bash
# Check what Client ID is being used
cat .env.local | grep GMAIL_CLIENT_ID

# Test the endpoint
curl http://localhost:3001/api/gmail/debug
```

## Most Likely Issue

**You're probably in the wrong Google Cloud project!**

- Check the project dropdown in Google Cloud Console
- Make sure the Client ID exists in that project
- Or create a new OAuth client in the current project

