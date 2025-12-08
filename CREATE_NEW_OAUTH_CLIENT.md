# Create Fresh Google OAuth Client - Step by Step

## Step 1: Create New OAuth Client in Google Cloud Console

1. **Go to Google Cloud Console:**
   https://console.cloud.google.com/apis/credentials

2. **Click "+ CREATE CREDENTIALS"** (top of the page)

3. **Select "OAuth client ID"**

4. **If prompted, configure OAuth consent screen first:**
   - Click "Configure Consent Screen"
   - User Type: **External** (unless you have Google Workspace)
   - App name: **OVRSEE**
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue"
   - Scopes: Click "Add or Remove Scopes"
     - Search and add:
       - `https://www.googleapis.com/auth/gmail.readonly`
       - `https://www.googleapis.com/auth/gmail.send`
       - `https://www.googleapis.com/auth/calendar`
     - Click "Update"
     - Click "Save and Continue"
   - Test users: Add `usecmdr@gmail.com`
   - Click "Save and Continue"
   - Click "Back to Dashboard"

5. **Create OAuth Client:**
   - Application type: **Web application**
   - Name: **OVRSEE Sync** (or any name)
   - **Authorized JavaScript origins:** (leave empty for now)
   - **Authorized redirect URIs:** Click "+ Add URI"
     - Add: `http://localhost:3000/api/sync/google/callback`
     - Click "Add"
   - Click **"Create"**

6. **Copy the credentials:**
   - **Client ID:** Copy the full ID (looks like: `xxxxx-xxxxx.apps.googleusercontent.com`)
   - **Client Secret:** Copy the secret (looks like: `GOCSPX-xxxxx`)
   - ⚠️ **IMPORTANT:** Copy these NOW - you won't be able to see the secret again!

## Step 2: Enable Required APIs

1. **Enable Gmail API:**
   - Go to: https://console.cloud.google.com/apis/library/gmail.googleapis.com
   - Click "Enable"

2. **Enable Calendar API:**
   - Go to: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
   - Click "Enable"

## Step 3: Update .env.local

After you have the new Client ID and Secret, we'll update your `.env.local` file.

## Step 4: Test

1. Restart dev server
2. Try connecting Gmail again


