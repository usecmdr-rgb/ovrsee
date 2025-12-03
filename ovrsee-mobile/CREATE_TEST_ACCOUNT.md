# Create Test Account - Step by Step

## The Problem
You're getting "Invalid email or password (Error 400)" because the account `test.basic@ovrsee.test` doesn't exist in Supabase.

## Solution: Create the Account

### Method 1: Supabase Dashboard (Recommended - Easiest)

1. **Open Supabase Dashboard:**
   - Go to: https://app.supabase.com
   - Sign in if needed

2. **Select Your Project:**
   - Click on project: `nupxbdbychuqokubresi` (or your project name)

3. **Go to Authentication:**
   - In left sidebar, click **"Authentication"**
   - Then click **"Users"** tab

4. **Create New User:**
   - Click the **"Add User"** button (top right)
   - Select **"Create new user"**

5. **Fill in Details:**
   - **Email:** `test.basic@ovrsee.test`
   - **Password:** `TestBasic123!`
   - ✅ **IMPORTANT:** Check **"Auto-confirm email"** (this is crucial!)
   - Leave other fields as default

6. **Create User:**
   - Click **"Create user"** button

7. **Verify:**
   - You should see the user in the list
   - Check that "Email Confirmed" shows ✅ (green checkmark)

### Method 2: Run Script (If you have service role key)

If you have `SUPABASE_SERVICE_ROLE_KEY` in your `.env.local`:

```bash
cd /Users/nemo/cursor/COMMANDX
node scripts/create-test-user.js
```

This will:
- Create the user `test.basic@ovrsee.test`
- Set password to `TestBasic123!`
- Auto-confirm the email
- Create a profile with Basic tier subscription

### Method 3: Sign Up via Web App

1. Go to your web app login page
2. Click "Sign Up" or "Create Account"
3. Enter:
   - Email: `test.basic@ovrsee.test`
   - Password: `TestBasic123!`
4. Complete signup
5. Verify email if required

## After Creating Account

1. **Go back to mobile app**
2. **Try logging in again:**
   - Email: `test.basic@ovrsee.test`
   - Password: `TestBasic123!`

3. **It should work now!** ✅

## Troubleshooting

### Still getting "Invalid email or password"?

1. **Check account exists:**
   - Go to Supabase Dashboard → Authentication → Users
   - Search for `test.basic@ovrsee.test`
   - Does it appear? ✅

2. **Check email is confirmed:**
   - In the user list, check "Email Confirmed" column
   - Should be ✅ (green checkmark)
   - If not, click user → "..." menu → "Confirm Email"

3. **Check password:**
   - Password must be exactly: `TestBasic123!` (case-sensitive)
   - If unsure, reset it in Supabase Dashboard

4. **Restart Expo:**
   ```bash
   cd ovrsee-mobile
   npx expo start -c
   ```

## Quick Checklist

- [ ] Account created in Supabase Dashboard
- [ ] Email is confirmed (✅ green checkmark)
- [ ] Password is exactly: `TestBasic123!`
- [ ] Expo server restarted
- [ ] Try logging in again

## Expected Result

After creating the account and logging in, you should:
- ✅ See the app dashboard
- ✅ No more error messages
- ✅ Be able to navigate the app



