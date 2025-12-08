#!/usr/bin/env node
/**
 * Check if profiles.updated_at column exists and provide fix SQL
 */

try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {}

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndFix() {
  console.log('🔍 Checking if profiles.updated_at column exists...\n');
  
  try {
    // Try to query the updated_at column
    const { data, error } = await supabase
      .from('profiles')
      .select('updated_at')
      .limit(1);
    
    if (error) {
      if (error.message?.includes('updated_at') || error.code === '42703') {
        console.log('❌ Column "updated_at" does NOT exist on profiles table\n');
        console.log('📝 Run this SQL in your Supabase Dashboard:\n');
        console.log('─'.repeat(80));
        console.log(`
-- Fix profiles.updated_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    
    CREATE INDEX IF NOT EXISTS idx_profiles_updated_at 
    ON public.profiles(updated_at);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
        `.trim());
        console.log('─'.repeat(80));
        console.log('\n💡 Steps:');
        console.log('   1. Go to: https://supabase.com/dashboard');
        console.log('   2. Select your project');
        console.log('   3. Go to SQL Editor');
        console.log('   4. Paste the SQL above');
        console.log('   5. Click "Run"');
        process.exit(1);
      } else {
        console.error('❌ Error checking column:', error.message);
        process.exit(1);
      }
    } else {
      console.log('✅ Column "updated_at" exists on profiles table!');
      console.log('   The migration may have already been applied.');
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkAndFix();


