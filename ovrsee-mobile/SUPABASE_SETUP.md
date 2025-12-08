# Supabase Setup for Mobile App

This mobile app now uses the same Supabase project as the web app, ensuring shared user data and authentication across both platforms.

## Environment Variables Required

Create a `.env` file in the `ovrsee-mobile/` directory with the following variables:

```bash
# These MUST match the web app's environment variables exactly
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### ⚠️ CRITICAL: Matching Values

The mobile app's environment variables must be **identical** to the web app's:

- `EXPO_PUBLIC_SUPABASE_URL` must match `NEXT_PUBLIC_SUPABASE_URL` (web app)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` must match `NEXT_PUBLIC_SUPABASE_ANON_KEY` (web app)

**To find your web app's values:**
1. Check your web app's `.env.local` or `.env` file
2. Copy the values for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Use those exact same values in the mobile app's `.env` file

## Installation

After adding the environment variables, install dependencies:

```bash
cd ovrsee-mobile
npm install
```

## What Changed

### New Files
- `src/lib/supabase.ts` - Supabase client initialization
- `src/lib/auth.ts` - Authentication utilities

### Updated Files
- `src/api/user.ts` - Now uses Supabase directly instead of HTTP API
- `src/api/http.ts` - Now includes Supabase auth tokens in requests
- `package.json` - Added `@supabase/supabase-js` dependency

## How It Works

1. **Authentication**: The mobile app uses Supabase Auth, the same system as the web app
2. **User Data**: Queries the same `profiles` table using the same user ID mapping (`profiles.id` = `auth.users.id`)
3. **Data Sharing**: Users logging in on web and mobile with the same email will see the same profile data

## Verification

To verify the setup is working:

1. Ensure environment variables are set correctly
2. The app should be able to authenticate users via Supabase
3. User profile data should be accessible from the `profiles` table
4. The same user account should work on both web and mobile apps

## Troubleshooting

**Error: "Missing required Supabase environment variables"**
- Make sure you've created a `.env` file in `ovrsee-mobile/`
- Ensure the variable names are exactly: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Restart the Expo development server after adding environment variables

**Users can't log in or see data**
- Verify the Supabase URL and anon key match the web app exactly
- Check that you're using the same Supabase project (not a different project)
- Ensure the `profiles` table exists in your Supabase database




