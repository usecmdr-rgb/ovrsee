# Setting Up Environment Variables for Mobile App

## Issue: "Unable to connect to authentication service"

This error occurs when Supabase environment variables are not configured.

## Quick Fix

1. **Create a `.env` file** in the `ovrsee-mobile/` directory:

```bash
cd ovrsee-mobile
touch .env
```

2. **Add your Supabase credentials** to the `.env` file:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. **Get these values from your web app:**
   - Look in the root directory (not `ovrsee-mobile/`) for `.env.local` or `.env`
   - Find `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy those EXACT same values

4. **Restart your Expo server:**
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart:
   npx expo start -c
   ```

## How to Find Your Supabase Values

### Option 1: From Web App Config
1. Go to the root directory (`/Users/nemo/cursor/COMMANDX/`)
2. Check for `.env.local` or `.env` file
3. Copy `NEXT_PUBLIC_SUPABASE_URL` → use as `EXPO_PUBLIC_SUPABASE_URL`
4. Copy `NEXT_PUBLIC_SUPABASE_ANON_KEY` → use as `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Option 2: From Supabase Dashboard
1. Go to https://app.supabase.com
2. Select your project
3. Go to Settings → API
4. Copy:
   - **Project URL** → use as `EXPO_PUBLIC_SUPABASE_URL`
   - **anon/public key** → use as `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Example `.env` File

```bash
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyMzQ1Njc4OSwiZXhwIjoxOTM5MDMxNzg5fQ.example_signature
```

## Important Notes

- ✅ The mobile app **MUST** use the same Supabase project as the web app
- ✅ Values must match exactly (same project URL and anon key)
- ✅ Restart Expo server after creating/updating `.env` file
- ✅ The `.env` file should be in `ovrsee-mobile/` directory (not root)

## After Setup

Once the `.env` file is created with the correct values:
1. Restart Expo: `npx expo start -c`
2. Try logging in again
3. The error should disappear and login should work

## Troubleshooting

**Still seeing the error?**
- Make sure `.env` file is in `ovrsee-mobile/` directory
- Check that variable names are exactly: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Verify values match your web app exactly
- Restart Expo with cache cleared: `npx expo start -c`



