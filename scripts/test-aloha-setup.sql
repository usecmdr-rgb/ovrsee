-- ============================================================================
-- Test Aloha Setup Script
-- ============================================================================
-- This script creates test data for Aloha MVP testing:
-- 1. A test workspace
-- 2. A test user_phone_number linked to that workspace
-- 3. An aloha_settings row for that workspace
--
-- Usage:
--   1. Replace USER_EMAIL with your actual test user email
--   2. Run this in Supabase SQL Editor or via psql
--   3. Or use: supabase db execute --file scripts/test-aloha-setup.sql
-- ============================================================================

-- Set the test user email (replace with your actual test user email)
\set test_user_email 'test@example.com'

-- Get the user ID from auth.users
DO $$
DECLARE
  test_user_id UUID;
  test_workspace_id UUID;
  test_phone_number TEXT := '+15551234567'; -- Test phone number
BEGIN
  -- Get user ID
  SELECT id INTO test_user_id
  FROM auth.users
  WHERE email = :'test_user_email'
  LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found. Please create a user first or update the email in this script.', :'test_user_email';
  END IF;

  -- Get or create workspace
  SELECT id INTO test_workspace_id
  FROM public.workspaces
  WHERE owner_user_id = test_user_id
  LIMIT 1;

  IF test_workspace_id IS NULL THEN
    -- Create workspace
    INSERT INTO public.workspaces (owner_user_id, name)
    VALUES (test_user_id, 'Test Workspace')
    RETURNING id INTO test_workspace_id;
    
    RAISE NOTICE 'Created workspace: %', test_workspace_id;
  ELSE
    RAISE NOTICE 'Using existing workspace: %', test_workspace_id;
  END IF;

  -- Create or update phone number
  INSERT INTO public.user_phone_numbers (
    workspace_id,
    user_id,
    phone_number,
    twilio_phone_sid,
    is_active,
    voicemail_enabled
  )
  VALUES (
    test_workspace_id,
    test_user_id,
    test_phone_number,
    'TEST_PHONE_SID_' || gen_random_uuid()::TEXT,
    TRUE,
    TRUE
  )
  ON CONFLICT (user_id) WHERE is_active = TRUE
  DO UPDATE SET
    workspace_id = EXCLUDED.workspace_id,
    phone_number = EXCLUDED.phone_number,
    twilio_phone_sid = EXCLUDED.twilio_phone_sid,
    voicemail_enabled = EXCLUDED.voicemail_enabled,
    updated_at = NOW();

  RAISE NOTICE 'Created/updated phone number: %', test_phone_number;

  -- Create or update aloha_settings
  INSERT INTO public.aloha_settings (
    workspace_id,
    greeting_message,
    voicemail_message,
    ai_enabled,
    ai_tone
  )
  VALUES (
    test_workspace_id,
    'Thank you for calling. Please hold while we connect you.',
    'Please leave a message after the beep.',
    TRUE,
    'professional'
  )
  ON CONFLICT (workspace_id)
  DO UPDATE SET
    greeting_message = EXCLUDED.greeting_message,
    voicemail_message = EXCLUDED.voicemail_message,
    ai_enabled = EXCLUDED.ai_enabled,
    ai_tone = EXCLUDED.ai_tone,
    updated_at = NOW();

  RAISE NOTICE 'Created/updated aloha_settings for workspace: %', test_workspace_id;

  -- Output summary
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Test Setup Complete!';
  RAISE NOTICE 'User ID: %', test_user_id;
  RAISE NOTICE 'Workspace ID: %', test_workspace_id;
  RAISE NOTICE 'Phone Number: %', test_phone_number;
  RAISE NOTICE '========================================';
END $$;

-- Verify the setup
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  upn.phone_number,
  upn.is_active as phone_active,
  upn.voicemail_enabled,
  as_settings.ai_enabled,
  as_settings.greeting_message
FROM public.workspaces w
LEFT JOIN public.user_phone_numbers upn ON upn.workspace_id = w.id AND upn.is_active = TRUE
LEFT JOIN public.aloha_settings as_settings ON as_settings.workspace_id = w.id
WHERE w.owner_user_id = (SELECT id FROM auth.users WHERE email = 'test@example.com' LIMIT 1);



