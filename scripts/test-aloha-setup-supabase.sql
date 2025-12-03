-- ============================================================================
-- Test Aloha Setup Script (Supabase SQL Editor Version)
-- ============================================================================
-- This script creates test data for Aloha MVP testing:
-- 1. A test workspace
-- 2. A test user_phone_number linked to that workspace
-- 3. An aloha_settings row for that workspace
--
-- Usage:
--   1. Replace 'test@example.com' with your actual test user email
--   2. Replace '+15551234567' with your test phone number
--   3. Run this in Supabase SQL Editor
-- ============================================================================

-- SET THESE VALUES FOR YOUR TEST:
-- Replace with your actual test user email
DO $$
DECLARE
  test_user_email TEXT := 'test@example.com';  -- ⚠️ UPDATE THIS
  test_phone_number TEXT := '+15551234567';     -- ⚠️ UPDATE THIS
  test_user_id UUID;
  test_workspace_id UUID;
BEGIN
  -- Get user ID
  SELECT id INTO test_user_id
  FROM auth.users
  WHERE email = test_user_email
  LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found. Please create a user first or update the email in this script.', test_user_email;
  END IF;

  RAISE NOTICE 'Found user: % (ID: %)', test_user_email, test_user_id;

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

  -- Deactivate any existing active phone numbers for this user
  UPDATE public.user_phone_numbers
  SET is_active = FALSE, updated_at = NOW()
  WHERE user_id = test_user_id AND is_active = TRUE;

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
  ON CONFLICT DO NOTHING;

  -- If insert didn't work (conflict), update existing
  IF NOT FOUND THEN
    UPDATE public.user_phone_numbers
    SET
      workspace_id = test_workspace_id,
      phone_number = test_phone_number,
      twilio_phone_sid = 'TEST_PHONE_SID_' || gen_random_uuid()::TEXT,
      is_active = TRUE,
      voicemail_enabled = TRUE,
      updated_at = NOW()
    WHERE user_id = test_user_id;
  END IF;

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
  RAISE NOTICE '✅ Test Setup Complete!';
  RAISE NOTICE 'User ID: %', test_user_id;
  RAISE NOTICE 'Workspace ID: %', test_workspace_id;
  RAISE NOTICE 'Phone Number: %', test_phone_number;
  RAISE NOTICE '========================================';
END $$;

-- Verify the setup
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  u.email as user_email,
  upn.phone_number,
  upn.is_active as phone_active,
  upn.voicemail_enabled,
  as_settings.ai_enabled,
  as_settings.greeting_message
FROM public.workspaces w
JOIN auth.users u ON u.id = w.owner_user_id
LEFT JOIN public.user_phone_numbers upn ON upn.workspace_id = w.id AND upn.is_active = TRUE
LEFT JOIN public.aloha_settings as_settings ON as_settings.workspace_id = w.id
WHERE u.email = 'test@example.com'  -- ⚠️ UPDATE THIS to match your test user
ORDER BY w.created_at DESC
LIMIT 1;



