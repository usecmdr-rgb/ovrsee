# Setting Up Subscription for Test User

To give `test.basic@ovrsee.test` basic tier access, follow these steps:

## Step 1: Run the Migration SQL

The subscription columns need to be added to the `profiles` table. Run this SQL in your Supabase SQL Editor:

```sql
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'subscription_tier'
    ) THEN
        ALTER TABLE profiles ADD COLUMN subscription_tier TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE profiles ADD COLUMN subscription_status TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id'
    ) THEN
        ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'stripe_subscription_id'
    ) THEN
        ALTER TABLE profiles ADD COLUMN stripe_subscription_id TEXT;
    END IF;
END $$;
```

## Step 2: Update User Subscription

After running the migration, call the API endpoint:

```bash
curl -X POST http://localhost:3001/api/test/set-subscription \
  -H "Content-Type: application/json" \
  -d '{"email":"test.basic@ovrsee.test","tier":"basic","status":"active"}'
```

Or use the script:

```bash
node scripts/update-user-subscription.js test.basic@ovrsee.test basic active
```

## Alternative: Using Supabase Dashboard

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the migration SQL above
4. Then run this to update the user:

```sql
UPDATE profiles 
SET 
  subscription_tier = 'basic',
  subscription_status = 'active'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'test.basic@ovrsee.test'
);
```

## Verify

After setting up, the user can:
1. Log in with `test.basic@ovrsee.test`
2. Navigate to `/account/subscription` to see their subscription details
3. View their current plan, payment methods, and available tiers

