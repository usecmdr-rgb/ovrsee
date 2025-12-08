# Verify Test Account Exists

## Quick Check

The error "Invalid email or password" usually means the account doesn't exist.

## Step 1: Check Supabase Dashboard

1. Open: https://app.supabase.com
2. Select your project
3. Go to **Authentication → Users**
4. Search for: `test.basic@ovrsee.test`

**Does it exist?**
- ✅ **Yes** → Go to Step 2 (check password/verification)
- ❌ **No** → Go to Step 3 (create account)

## Step 2: If Account Exists

Check these:
1. **Email confirmed?** → Should be ✅ (green checkmark)
2. **Password correct?** → Should be `TestBasic123!`

If email not confirmed:
- Click the user → "..." menu → "Confirm Email"

If password wrong:
- Click the user → "..." menu → "Reset Password"
- Or update manually

## Step 3: Create Account (If Doesn't Exist)

### Method 1: Supabase Dashboard (Easiest)

1. Go to **Authentication → Users**
2. Click **"Add User"** → **"Create new user"**
3. Fill in:
   - **Email:** `test.basic@ovrsee.test`
   - **Password:** `TestBasic123!`
   - ✅ **Auto-confirm email** (check this!)
4. Click **"Create user"**

### Method 2: Run Script

```bash
cd /Users/nemo/cursor/COMMANDX
node scripts/create-test-user.js
```

**Note:** Requires `SUPABASE_SERVICE_ROLE_KEY` in your `.env.local`

### Method 3: Sign Up via Web App

1. Go to your web app login page
2. Click "Sign Up"
3. Email: `test.basic@ovrsee.test`
4. Password: `TestBasic123!`
5. Verify email if prompted

## Step 4: After Creating Account

1. **Restart Expo:**
   ```bash
   npx expo start -c
   ```

2. **Try logging in again:**
   - Email: `test.basic@ovrsee.test`
   - Password: `TestBasic123!`

## Expected Result

✅ Login should work and you should see the app dashboard.

## Still Not Working?

Check browser console (F12) for:
- `[Login]` messages
- `[Supabase]` messages  
- Exact error codes and messages

Share:
1. Does account exist in Supabase Dashboard?
2. What's the exact error message?
3. What do you see in console (F12)?




