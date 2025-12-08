# Quick Fix: Login Error - "Unable to connect to authentication service"

## The Problem
The mobile app can't connect to Supabase because environment variables are missing.

## The Solution (3 Steps)

### Step 1: Create `.env` file
In the `ovrsee-mobile/` directory, create a file named `.env`:

```bash
cd /Users/nemo/cursor/COMMANDX/ovrsee-mobile
touch .env
```

### Step 2: Add Supabase Credentials
Open the `.env` file and add these two lines (replace with your actual values):

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**Where to find these values:**
- Check your web app's `.env.local` file in the root directory
- Or check your Supabase dashboard: https://app.supabase.com → Your Project → Settings → API

### Step 3: Restart Expo
```bash
# Stop current server (Ctrl+C), then:
npx expo start -c
```

## Example `.env` file

```bash
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Important Notes

⚠️ **These values MUST match your web app's Supabase configuration exactly**
- Web app uses: `NEXT_PUBLIC_SUPABASE_URL`
- Mobile app uses: `EXPO_PUBLIC_SUPABASE_URL` (same value, different name)

After adding the `.env` file and restarting, try logging in again!




