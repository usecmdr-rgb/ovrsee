-- ============================================================================
-- Migration Verification Script
-- ============================================================================
-- Run this in the Supabase SQL Editor to verify that all key tables exist
-- ============================================================================

-- Check core tables
SELECT 
  'Core Tables' as category,
  table_name,
  CASE 
    WHEN table_name IN (
      'user_phone_numbers',
      'user_phone_number_changes',
      'business_profiles',
      'call_logs',
      'profiles',
      'subscriptions',
      'agents',
      'agent_conversations',
      'agent_messages'
    ) THEN '✓'
    ELSE '✗'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'user_phone_numbers',
    'user_phone_number_changes',
    'business_profiles',
    'call_logs',
    'profiles',
    'subscriptions',
    'agents',
    'agent_conversations',
    'agent_messages'
  )
ORDER BY table_name;

-- Check Aloha-specific tables
SELECT 
  'Aloha Tables' as category,
  table_name,
  CASE 
    WHEN table_name IN (
      'aloha_profiles',
      'contact_profiles',
      'call_campaigns',
      'call_campaign_targets',
      'agent_knowledge_gaps'
    ) THEN '✓'
    ELSE '✗'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'aloha_profiles',
    'contact_profiles',
    'call_campaigns',
    'call_campaign_targets',
    'agent_knowledge_gaps'
  )
ORDER BY table_name;

-- Check key columns in user_phone_numbers
SELECT 
  'user_phone_numbers columns' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_phone_numbers'
  AND column_name IN (
    'phone_number',
    'twilio_phone_sid',
    'is_active',
    'external_phone_number',
    'voicemail_enabled',
    'voicemail_mode',
    'forwarding_enabled',
    'forwarding_confirmed'
  )
ORDER BY column_name;

-- Check key columns in business_profiles
SELECT 
  'business_profiles columns' as check_type,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_profiles'
  AND column_name IN (
    'business_name',
    'assistant_name',
    'voice_key',
    'primary_website_url',
    'additional_urls',
    'preferences',
    'image_watermark_position'
  )
ORDER BY column_name;

-- Check indexes on user_phone_numbers
SELECT 
  'Indexes on user_phone_numbers' as check_type,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'user_phone_numbers'
ORDER BY indexname;

-- Check RLS policies
SELECT 
  'RLS Policies' as check_type,
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'user_phone_numbers',
    'business_profiles',
    'contact_profiles'
  )
ORDER BY tablename, policyname;

-- Check functions
SELECT 
  'Functions' as check_type,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'disable_voicemail_on_number_release',
    'update_user_phone_numbers_updated_at',
    'normalize_phone_number',
    'update_business_profiles_updated_at'
  )
ORDER BY routine_name;

-- Summary: Count all tables
SELECT 
  'Summary' as check_type,
  COUNT(*) as total_tables,
  COUNT(CASE WHEN table_name IN (
    'user_phone_numbers',
    'user_phone_number_changes',
    'business_profiles',
    'call_logs',
    'profiles',
    'subscriptions',
    'agents',
    'agent_conversations',
    'agent_messages',
    'aloha_profiles',
    'contact_profiles',
    'call_campaigns',
    'call_campaign_targets',
    'agent_knowledge_gaps'
  ) THEN 1 END) as key_tables_found
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';



