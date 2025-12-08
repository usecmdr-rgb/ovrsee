# Quick Fix: Gmail Connection "invalid_client" Error

## The Problem

You're getting "Error 401: invalid_client" because the redirect URI in your code doesn't match what's configured in Google Cloud Console.

## The Solution (2 Steps)

### Step 1: Fix .env.local

Open `.env.local` and find the line with `GMAIL_REDIRECT_URI`. 

**If it's commented out or has the wrong value, change it to:**

```bash
GMAIL_REDIRECT_URI=http://localhost:3001/api/gmail/callback
```

**Make sure:**
- It's **uncommented** (no `#` at the start)
- Port is **3001** (not 3000)
- No trailing slash
- Uses `http://` not `https://`

### Step 2: Update Google Cloud Console

1. **Go to:** https://console.cloud.google.com/apis/credentials
2. **Click** on your OAuth 2.0 Client ID (the one with ID `1077385431224-...`)
3. **Scroll** to "Authorized redirect URIs"
4. **Check** if this EXACT URI is listed:
   ```
   http://localhost:3001/api/gmail/callback
   ```
5. **If it's missing:**
   - Click **"+ ADD URI"**
   - Paste: `http://localhost:3001/api/gmail/callback`
   - **NO trailing slash!**
   - Click **"SAVE"**

### Step 3: Restart Server

```bash
# Stop server (Ctrl+C)
npm run dev
```

### Step 4: Test

Visit: http://localhost:3001/api/gmail/test

This shows your current configuration and what redirect URI is being used.

## That's It!

After these steps, try connecting Gmail again from the Sync page.

## Common Mistakes

❌ `http://localhost:3000/api/gmail/callback` (wrong port)  
❌ `http://localhost:3001/api/gmail/callback/` (trailing slash)  
❌ `https://localhost:3001/api/gmail/callback` (HTTPS instead of HTTP)  
✅ `http://localhost:3001/api/gmail/callback` (correct!)




