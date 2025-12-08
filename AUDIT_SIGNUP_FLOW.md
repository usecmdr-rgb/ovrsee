# Signup Flow Audit Report

## Current Signup Flow

### 1. Frontend (AuthModal.tsx)
- User fills signup form (email, password, companyName)
- Submits to `/api/auth/signup`

### 2. API Route (`app/api/auth/signup/route.ts`)
- Validates email format and password strength
- Checks if email already exists
- Calls `createUserAccount()` from `lib/auth/signup.ts`
- Returns user and session data

### 3. User Creation (`lib/auth/signup.ts`)
- Uses `supabase.auth.admin.createUser()` to create user in Supabase Auth
- **Expected**: Database trigger `on_auth_user_created` should automatically:
  - Create profile in `profiles` table
  - Create subscription in `subscriptions` table
  - Create workspace in `workspaces` table
  - Create owner seat in `workspace_seats` table
- **Fallback**: Code checks if profile exists and creates it if missing

## Issues Found

### Issue 1: Database Trigger May Not Be Applied
The trigger `on_auth_user_created` should run automatically when a user is created, but:
- Migration `20241215000000_fix_user_creation_trigger.sql` creates the trigger
- Migration `20250120000001_fix_user_creation_trigger_robust.sql` updates it with better error handling
- **ACTION NEEDED**: Verify trigger exists in Supabase Dashboard

### Issue 2: Profile Creation Fallback May Fail
The fallback code tries to insert profile with `subscription_tier` and `subscription_status`:
```typescript
subscription_tier: "free",
subscription_status: "active",
```
But the trigger only inserts minimal fields (id, email, full_name). If the trigger fails and fallback runs, it might hit constraint issues.

### Issue 3: Error Logging Not Showing Actual Error
The error "Database error creating new user" suggests the error object doesn't have a message property, making debugging difficult.

## Recommendations

1. **Verify Trigger Exists**: Check Supabase Dashboard → Database → Triggers
2. **Apply Robust Trigger Migration**: Run `20250120000001_fix_user_creation_trigger_robust.sql` in Supabase SQL Editor
3. **Fix Profile Fallback**: Update fallback to use minimal fields like the trigger
4. **Add Better Error Handling**: Capture and log actual Supabase errors

## Testing Checklist

- [ ] Run `scripts/verify-signup-setup.sql` in Supabase SQL Editor
- [ ] Verify trigger `on_auth_user_created` exists in Supabase Dashboard → Database → Triggers
- [ ] Test user creation via Supabase Dashboard directly (Auth → Users → Add User)
- [ ] Check Supabase logs for trigger errors (Dashboard → Logs → Postgres Logs)
- [ ] Verify profile table constraints match what we're inserting
- [ ] Test signup flow end-to-end with detailed logging enabled

## Next Steps

1. **Apply Robust Trigger Migration**:
   - Go to Supabase Dashboard → SQL Editor
   - Run the contents of `supabase/migrations/20250120000001_fix_user_creation_trigger_robust.sql`
   - This ensures the trigger won't fail user creation even if profile/workspace creation has issues

2. **Verify Setup**:
   - Run `scripts/verify-signup-setup.sql` to check everything is configured

3. **Test Signup**:
   - Try creating an account
   - Check terminal logs for detailed error output
   - Check Supabase Dashboard → Auth → Users to see if user was created
   - Check Supabase Dashboard → Table Editor → profiles to see if profile was created

## Fixed Issues

✅ **Profile Fallback Updated**: Now uses minimal fields (id, email, full_name, company_name) to match trigger
✅ **Better Error Logging**: Added detailed logging for profile creation errors
✅ **Audit Document**: Created comprehensive audit document for troubleshooting

