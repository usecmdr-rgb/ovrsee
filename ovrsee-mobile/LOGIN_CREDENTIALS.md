# Login Credentials for Mobile App

## Test Account

**Email:** `test.basic@ovrsee.test`  
**Password:** `TestBasic123!`

**Note:** The full email address is required - don't use just "test.basic"

## Your Account

**Email:** `usecmdr@gmail.com`  
**Password:** (your password)

## Important Notes

### Email Format
- Always use the **full email address** including the domain
- Example: `test.basic@ovrsee.test` ✅ (correct)
- Example: `test.basic` ❌ (incorrect - missing domain)

### Email Verification
If you see "Email not confirmed" error:
- Check your email inbox for verification link
- Or verify the account in Supabase dashboard

### If Login Still Doesn't Work

1. **Check the exact error message** - it will tell you what's wrong
2. **Restart Expo** - `npx expo start -c`
3. **Check browser console** (F12) for detailed logs
4. **Verify account exists** in Supabase dashboard:
   - Go to https://app.supabase.com
   - Your project → Authentication → Users
   - Check if email exists and is confirmed

### Common Errors

- **"Invalid email or password"** - Check email format and password
- **"Email not confirmed"** - Verify email address in inbox
- **"Connection error"** - Check Supabase configuration in `.env` file
- **"User not found"** - Account doesn't exist, may need to sign up first




