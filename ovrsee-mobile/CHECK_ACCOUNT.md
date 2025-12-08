# How to Check if Your Account Exists

## Quick Check

The login error "Invalid email or password" can mean:
1. Account doesn't exist in Supabase
2. Password is incorrect
3. Email not verified (if verification required)

## Check in Supabase Dashboard

1. Go to: https://app.supabase.com
2. Select your project (nupxbdbychuqokubresi)
3. Go to **Authentication → Users**
4. Search for: `test.basic@ovrsee.test`
5. Check if the user exists

## If Account Doesn't Exist

### Option 1: Create via Supabase Dashboard
1. Go to **Authentication → Users**
2. Click **"Add User"** → **"Create new user"**
3. Email: `test.basic@ovrsee.test`
4. Password: `TestBasic123!`
5. ✅ **Auto-confirm email** (check this!)
6. Click **"Create user"**

### Option 2: Create via Web App Sign Up
1. Go to your web app login page
2. Click "Sign Up"
3. Use: `test.basic@ovrsee.test` / `TestBasic123!`
4. Verify email if required

## Verify Password

If account exists but login fails:
1. In Supabase Dashboard → Authentication → Users
2. Find the user
3. Click **"Reset Password"** to set a new password
4. Or update password manually

## Check Browser Console

When you try to log in, open browser console (F12) and look for:
- `[Login]` messages
- `[Supabase]` messages
- Error details with status codes

The console will show:
- Exact error message from Supabase
- Error status code (400, 401, etc.)
- Connection status

## Test Account Details

According to TEST_USER_CREDENTIALS.md:
- **Email:** `test.basic@ovrsee.test`
- **Password:** `TestBasic123!`
- **User ID:** `42bff91f-00de-43fe-95ff-6c650412b8d4`

If this account doesn't exist, create it using the steps above.

## Common Issues

### "Invalid email or password" but account exists
- Check password is exactly: `TestBasic123!` (case-sensitive)
- Try resetting password in Supabase
- Check email verification status

### Account created but can't log in
- Verify email is confirmed (Auto-confirm when creating)
- Check that account appears in Authentication → Users
- Try resetting password

### Connection errors
- Check `.env` file has correct Supabase URL/key
- Restart Expo: `npx expo start -c`
- Check internet connection




