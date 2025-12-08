# Gmail Redirect URI Fix

## Issue
The redirect URI was using port 3000 from the request origin instead of respecting `NEXT_PUBLIC_APP_URL` (port 3001).

## Fix Applied
Updated `lib/oauth-helpers.ts` to prioritize `NEXT_PUBLIC_APP_URL` over request origin.

## Current Configuration
- `NEXT_PUBLIC_APP_URL=http://localhost:3001` (from .env.local)
- Redirect URI will now be: `http://localhost:3001/api/gmail/callback`

## Action Required

### Option 1: Use Port 3001 (Recommended if server runs on 3001)
1. Ensure your dev server runs on port 3001:
   ```bash
   npm run dev  # This uses port 3001 per package.json
   ```

2. Update Google Cloud Console:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click your OAuth 2.0 Client ID
   - Under "Authorized redirect URIs", ensure this EXACT URI is listed:
     ```
     http://localhost:3001/api/gmail/callback
     ```
   - Click "SAVE"

### Option 2: Use Port 3000 (If server runs on 3000)
1. Update `.env.local`:
   ```bash
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

2. Restart dev server

3. Update Google Cloud Console:
   - Add redirect URI: `http://localhost:3000/api/gmail/callback`

## Verify Fix
After restarting the server, visit:
```
http://localhost:3001/api/gmail/check-config
```

Should show redirect URI as: `http://localhost:3001/api/gmail/callback`

## Test Connection
1. Go to: `http://localhost:3001/sync`
2. Click "Connect Gmail"
3. Should redirect to Google OAuth (no `invalid_client` error)
4. After authorizing, should redirect back successfully




