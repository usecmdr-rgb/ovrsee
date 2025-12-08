-- Verification script for signup flow setup
-- Run this in Supabase SQL Editor to verify everything is configured correctly

-- 1. Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 2. Check if function exists
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'create_workspace_for_user';

-- 3. Check profiles table structure (IMPORTANT: See what columns actually exist)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 4. Check profiles table constraints
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' 
  AND table_name = 'profiles';

-- 5. Check if there are any existing profiles (to verify trigger has worked before)
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- 6. Check recent user creations (last 24 hours)
-- This query only uses columns that definitely exist: user id, email, created_at, and profile id
SELECT 
  u.id as user_id,
  u.email as user_email,
  u.created_at as user_created_at,
  CASE WHEN p.id IS NOT NULL THEN 'Profile exists' ELSE 'No profile' END as profile_status,
  p.id as profile_id
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.created_at > NOW() - INTERVAL '24 hours'
ORDER BY u.created_at DESC
LIMIT 10;
