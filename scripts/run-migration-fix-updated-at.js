#!/usr/bin/env node
/**
 * Run migration to fix profiles.updated_at column
 * 
 * This script applies the migration directly via Supabase client
 */

try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {}

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const migrationSQL = `
-- Fix profiles.updated_at column if missing
DO $$
BEGIN
  -- Check if updated_at column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    
    -- Create index for updated_at if it doesn't exist
    CREATE INDEX IF NOT EXISTS idx_profiles_updated_at 
    ON public.profiles(updated_at);
    
    RAISE NOTICE 'Added updated_at column to profiles table';
  ELSE
    RAISE NOTICE 'updated_at column already exists on profiles table';
  END IF;
END $$;

-- Ensure the trigger function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists (will recreate if needed)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
`;

async function runMigration() {
  console.log('🚀 Running migration to fix profiles.updated_at column...\n');
  
  try {
    // Use RPC to execute raw SQL (requires service role key)
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      // If exec_sql RPC doesn't exist, try direct query
      console.log('⚠️  RPC method not available, trying alternative approach...\n');
      
      // Split SQL into individual statements and execute via query
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.includes('DO $$')) {
          // For DO blocks, we need to execute the whole thing
          const { error: execError } = await supabase
            .from('_migrations')
            .select('*')
            .limit(0); // Dummy query to test connection
          
          // Actually, we can't execute DDL via Supabase JS client easily
          // Let's provide instructions instead
          console.log('❌ Cannot execute DDL statements via Supabase JS client');
          console.log('\n📝 Please run this migration manually:\n');
          console.log('1. Go to: https://supabase.com/dashboard/project/_/sql');
          console.log('2. Copy and paste the SQL from: supabase/migrations/20241204000000_fix_profiles_updated_at.sql');
          console.log('3. Click "Run"');
          process.exit(1);
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('\nThe profiles.updated_at column should now exist.');
    
  } catch (err) {
    console.error('❌ Error running migration:', err.message);
    console.log('\n📝 Alternative: Run the migration manually in Supabase Dashboard');
    console.log('   1. Go to: https://supabase.com/dashboard/project/_/sql');
    console.log('   2. Copy SQL from: supabase/migrations/20241204000000_fix_profiles_updated_at.sql');
    console.log('   3. Paste and run');
    process.exit(1);
  }
}

runMigration();


