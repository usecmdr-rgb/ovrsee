# Debugging Login Issues

## Current Issue
Login credentials don't work for the mobile app, even though they work in the web app.

## What to Check

### 1. Restart Expo Server
**Important**: Expo only loads environment variables when the server starts. After creating/updating `.env`:

```bash
# Stop the server (Ctrl+C)
# Then restart with cache clear:
npx expo start -c
```

### 2. Check Environment Variables
The `.env` file should be in `ovrsee-mobile/` directory with:
```
EXPO_PUBLIC_SUPABASE_URL=https://nupxbdbychuqokubresi.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key_here
```

### 3. Check Browser Console
When you try to log in, check the browser console (F12) for error messages. Look for:
- `[Login]` prefixed messages
- `[Supabase]` prefixed messages
- Any network errors

### 4. Common Issues

#### Issue: "Invalid email or password"
**Possible causes:**
- Email/username format incorrect (should be full email address)
- Password incorrect
- Account doesn't exist in Supabase
- Email not verified (if email verification is required)

**Solutions:**
- Try the exact email used in web app (case-sensitive)
- Reset password if needed
- Check if account exists in Supabase dashboard

#### Issue: "Email not confirmed"
**Solution:**
- Check your email inbox for verification link
- Or disable email verification in Supabase dashboard temporarily

#### Issue: "Connection error" or "Failed to fetch"
**Possible causes:**
- Supabase URL/key incorrect
- CORS issues
- Network problems

**Solutions:**
- Verify `.env` values match web app exactly
- Check Supabase project settings → API → CORS
- Ensure you can access Supabase dashboard

### 5. Test Credentials

Try these in order:
1. **usecmdr@gmail.com** - The email you mentioned
2. **test.basic** - If this is an email, use full format: `test.basic@example.com`
3. Check Supabase dashboard for actual user emails

### 6. Verify in Supabase Dashboard

1. Go to https://app.supabase.com
2. Select your project
3. Go to Authentication → Users
4. Check if your email exists
5. Verify email is confirmed
6. Check if password is set

### 7. Test Direct Connection

The app now tests the Supabase connection before login. If you see "Connection issue" error, check:
- `.env` file location and values
- Expo server restart
- Internet connection

### 8. Check Error Messages

The login screen now shows detailed error messages. Look for:
- Specific error codes (400, 401, 500, etc.)
- Exact error messages from Supabase
- Connection status

## Next Steps

1. **Restart Expo**: `npx expo start -c`
2. **Try login again** with exact email
3. **Check console** (F12) for `[Login]` and `[Supabase]` messages
4. **Share the exact error message** you see

## If Still Not Working

Share:
1. The exact error message shown on screen
2. Console errors (F12)
3. Whether the account works in web app
4. Whether account exists in Supabase dashboard




