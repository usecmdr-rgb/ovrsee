/**
 * Script to add subscription columns to profiles table
 * This runs the migration SQL directly
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for scripts/add-subscription-columns.js'
  );
}

// Use the REST API directly to run SQL
async function addColumns() {
  try {
    console.log('Adding subscription columns to profiles table...');
    
    // We need to use the PostgREST admin API or direct SQL
    // Since Supabase JS doesn't support raw SQL easily, we'll use the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `
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
        `
      })
    });

    if (!response.ok) {
      console.log('RPC method not available, trying alternative approach...');
      console.log('Please run the migration SQL manually in your Supabase dashboard:');
      console.log('\n' + require('fs').readFileSync(__dirname + '/../supabase/migrations/20241127000000_add_subscription_columns.sql', 'utf8'));
      return;
    }

    console.log('✓ Columns added successfully');
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nPlease run the migration SQL manually in your Supabase dashboard:');
    console.log('\n' + require('fs').readFileSync(__dirname + '/../supabase/migrations/20241127000000_add_subscription_columns.sql', 'utf8'));
  }
}

addColumns();

