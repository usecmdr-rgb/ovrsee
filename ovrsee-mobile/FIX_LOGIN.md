# Fix: Login Not Working

## Immediate Steps

### 1. Check Browser Console (F12)
When you try to log in, open browser console and look for:
- `[Login]` messages showing what's happening
- `[Supabase]` messages showing connection status
- Error details with status codes

**What to look for:**
- Status code: `400` = Invalid credentials
- Status code: `401` = Authentication failed
- Any network errors

### 2. Verify Account Exists in Supabase

**Option A: Check via Supabase Dashboard**
1. Go to: https://app.supabase.com
2. Select project: `nupxbdbychuqokubresi`
3. Go to **Authentication → Users**
4. Search for: `test.basic@ovrsee.test`
5. Does it exist? ✅ or ❌

**Option B: Create the Account**

If the account doesn't exist, create it:

1. **Via Supabase Dashboard (Easiest):**
   - Go to **Authentication → Users**
   - Click **"Add User"** → **"Create new user"**
   - Email: `test.basic@ovrsee.test`
   - Password: `TestBasic123!`
   - ✅ **Check "Auto-confirm email"** (IMPORTANT!)
   - Click **"Create user"**

2. **Via Script (if you have service role key):**
   ```bash
   cd /Users/nemo/cursor/COMMANDX
   node scripts/create-test-user.js
   ```

3. **Via Web App Sign Up:**
   - Go to your web app
   - Click "Sign Up"
   - Email: `test.basic@ovrsee.test`
   - Password: `TestBasic123!`
   - Verify email if needed

### 3. Verify Password

If account exists but login fails:
- Password must be exactly: `TestBasic123!` (case-sensitive)
- In Supabase Dashboard, you can reset password:
  - Find user → Click "..." → "Reset Password"

### 4. Check Email Verification

The account might exist but email isn't confirmed:
- In Supabase Dashboard → Authentication → Users
- Find the user
- Check if "Email Confirmed" is ✅
- If not, click "..." → "Confirm Email"

### 5. Restart Expo

After making changes:
```bash
# Stop server (Ctrl+C)
npx expo start -c
```

## Test Credentials

**Expected:**
- Email: `test.basic@ovrsee.test`
- Password: `TestBasic123!`

## Most Likely Issues

### ❌ Account Doesn't Exist
**Solution:** Create account using steps above

### ❌ Wrong Password
**Solution:** Reset password in Supabase Dashboard

### ❌ Email Not Verified
**Solution:** Confirm email in Supabase Dashboard or check "Auto-confirm" when creating

### ❌ Connection Issue
**Solution:** 
- Check `.env` file exists in `ovrsee-mobile/` directory
- Restart Expo: `npx expo start -c`
- Check browser console for connection errors

## Debug Information

The login screen now shows detailed error messages. Check:
1. **Error message on screen** - What does it say exactly?
2. **Browser console** (F12) - Look for `[Login]` and `[Supabase]` messages
3. **Supabase Dashboard** - Does the user exist?

## Next Steps

1. **First:** Check if account exists in Supabase Dashboard
2. **If not exists:** Create it (steps above)
3. **If exists:** Check password and email verification status
4. **Restart Expo** after any changes
5. **Try logging in again**
6. **Check console** for detailed error messages

## Still Not Working?

Share:
1. Does the account exist in Supabase Dashboard? (Yes/No)
2. What's the exact error message on screen?
3. What do you see in browser console (F12)?
4. Did you restart Expo after creating account?




