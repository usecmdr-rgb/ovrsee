# Gmail OAuth Setup Guide

This guide will help you set up Gmail OAuth to enable the Gmail integration in the Sync agent.

## Prerequisites

- A Google account
- Access to Google Cloud Console

## Quick Test

Before setting up, you can check your current configuration by visiting:
- **Local**: `http://localhost:3000/api/gmail/test` (or your port)
- This will show you what's configured and what's missing

## Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter a project name (e.g., "OVRSEE Gmail Integration")
5. Click "Create"

### 2. Enable Gmail API

1. In your project, go to **APIs & Services** > **Library**
2. Search for "Gmail API"
3. Click on "Gmail API"
4. Click **Enable**

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External** (for testing) or **Internal** (for Google Workspace)
   - App name: "OVRSEE"
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue**
   - Scopes: Click **Add or Remove Scopes**, search for "Gmail", select:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.modify`
   - Click **Save and Continue**
   - Test users: Add your email address
   - Click **Save and Continue**
   - Click **Back to Dashboard**

4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: "OVRSEE Gmail Client"
   - Authorized redirect URIs: Click **+ ADD URI** and add:
     - For local development: `http://localhost:3000/api/gmail/callback`
     - For production: `https://yourdomain.com/api/gmail/callback`
   - Click **Create**

5. **Important**: Copy the **Client ID** and **Client Secret** immediately (you won't be able to see the secret again)

### 4. Add Credentials to Your Project

1. Open your `.env.local` file in the project root
2. Replace the placeholders with your actual credentials:

```env
GMAIL_CLIENT_ID=your_actual_client_id_here
GMAIL_CLIENT_SECRET=your_actual_client_secret_here
```

3. If your app runs on a different port, update:
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback
```

### 5. Restart Your Development Server

After adding the credentials, restart your Next.js development server:

```bash
npm run dev
```

### 6. Verify Configuration

1. Visit `http://localhost:3000/api/gmail/test` (or your port) to see a configuration status page
2. This will show you if everything is set up correctly

### 7. Test the Connection

1. Go to the Sync agent page (`/sync`)
2. Click "Connect your Gmail"
3. You should see a Google sign-in popup
4. Sign in with your Google account
5. Grant the requested permissions
6. You should be redirected back and see "Gmail Connected"

## Troubleshooting

### Error: "invalid_request" or "redirect_uri_mismatch"

This means the redirect URI in your `.env.local` doesn't match what's configured in Google Cloud Console.

**Fix:**
1. Check your `.env.local` file for `GMAIL_REDIRECT_URI` or `NEXT_PUBLIC_APP_URL`
2. Ensure the redirect URI in Google Cloud Console matches exactly:
   - `http://localhost:3000/api/gmail/callback` (for local dev)
   - No trailing slashes
   - Exact match including protocol (http vs https)

### Error: "Gmail OAuth is not configured"

This means the environment variables are not set.

**Fix:**
1. Check that `.env.local` exists in the project root
2. Verify `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` are set
3. Restart your development server

### Error: "Access blocked: This app's request is invalid"

This usually means:
- The OAuth consent screen is not properly configured
- Your email is not added as a test user (for external apps)
- The app is in testing mode and needs verification

**Fix:**
1. Go to **APIs & Services** > **OAuth consent screen**
2. Make sure your email is added as a test user
3. For production, you'll need to verify your app with Google

### The OAuth popup opens but shows an error

Check the browser console for specific error messages. Common issues:
- Client ID is incorrect
- Redirect URI mismatch
- App not published (for external apps, add test users)

## Security Notes

- Never commit `.env.local` to version control
- Keep your Client Secret secure
- Rotate credentials if they're compromised
- Use different credentials for development and production

## Production Setup

For production:
1. Create a separate OAuth client ID in Google Cloud Console
2. Add your production domain to authorized redirect URIs
3. Update `.env.local` (or your production environment variables) with production credentials
4. Consider publishing your app in Google Cloud Console for public use

## Need Help?

If you're still having issues:
1. Check the browser console for error messages
2. Check the server logs for API errors
3. Verify all environment variables are set correctly
4. Ensure the redirect URI matches exactly in Google Cloud Console

