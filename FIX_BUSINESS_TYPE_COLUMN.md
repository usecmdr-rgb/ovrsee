# Fix: Missing `business_type` Column Error

## Problem
Error: `PGRST204 - Could not find the 'business_type' column of 'business_profiles' in the schema cache`

The migration file exists but hasn't been applied to your database.

## Solution Options

### Option 1: Run Migration via Supabase CLI (Recommended)

If you have Supabase CLI set up:

```bash
# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Run pending migrations
supabase db push
```

### Option 2: Run SQL Directly in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run this SQL:

```sql
-- Add business_type column to business_profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profiles' 
    AND column_name = 'business_type'
  ) THEN
    ALTER TABLE business_profiles ADD COLUMN business_type TEXT;
    COMMENT ON COLUMN business_profiles.business_type IS 'Industry/type of business';
  END IF;
END $$;
```

### Option 3: Refresh PostgREST Schema Cache (After Adding Column)

After adding the column, you may need to refresh PostgREST's schema cache:

1. In Supabase Dashboard, go to Settings → API
2. Click "Reload Schema" or restart your Supabase instance
3. Alternatively, wait a few minutes for the cache to refresh automatically

## Verification

After running the migration, verify the column exists:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_profiles' 
AND column_name = 'business_type';
```

You should see:
```
column_name   | data_type
--------------+----------
business_type | text
```


