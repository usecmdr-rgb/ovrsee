# Test User Credentials - Basic Tier

## User Account
- **Email:** `test.basic@commanderx.test`
- **Password:** `TestBasic123!`

## Subscription Details
- **Tier:** Basic
- **Status:** Active
- **Accessible Agents:** Sync only

## Preview Mode Access
This user will see **preview mode** (with sample data) for:
- **Aloha** (requires Advanced tier)
- **Studio** (requires Advanced tier)  
- **Insight** (requires Elite tier)

## Full Access
This user has **full access** to:
- **Sync** agent (email & calendar)

## Setup Instructions

### Option 1: Run the script (if migration is applied)
```bash
node scripts/create-test-user.js
```

### Option 2: Manual Setup in Supabase

1. **Create the user in Supabase Auth:**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add User" → "Create new user"
   - Email: `test.basic@commanderx.test`
   - Password: `TestBasic123!`
   - Auto-confirm email: ✅

2. **Update the profile:**
   - Go to Supabase Dashboard → Table Editor → `profiles`
   - Find the user by email or user ID
   - Update the row:
     - `subscription_tier`: `basic`
     - `subscription_status`: `active`

   Or run this SQL:
   ```sql
   UPDATE profiles 
   SET subscription_tier = 'basic', 
       subscription_status = 'active' 
   WHERE id = '<user-id-from-auth>';
   ```

## Testing Preview Mode

1. Log in with the credentials above
2. Navigate to:
   - `/aloha` - Should show preview banner and sample data
   - `/studio` - Should show preview banner and sample data
   - `/insight` - Should show preview banner and sample data
   - `/sync` - Should show full access (no preview banner)

## Notes
- The user was created with ID: `42bff91f-00de-43fe-95ff-6c650412b8d4`
- You may need to run the migration `20241127000000_add_subscription_columns.sql` first if the columns don't exist
- If the profile table doesn't have subscription columns, create them manually or run the migration

