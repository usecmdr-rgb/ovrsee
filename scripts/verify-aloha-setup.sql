-- ============================================================================
-- Verify Aloha Test Setup
-- ============================================================================
-- Run this after test-aloha-setup.sql to verify everything is configured
-- ============================================================================

-- Replace with your test user email
\set test_user_email 'test@example.com'

-- 1. Check workspace exists
SELECT 
  'Workspace' as check_type,
  w.id as workspace_id,
  w.name as workspace_name,
  w.owner_user_id,
  u.email as owner_email
FROM public.workspaces w
JOIN auth.users u ON u.id = w.owner_user_id
WHERE u.email = :'test_user_email'
LIMIT 1;

-- 2. Check phone number exists and is active
SELECT 
  'Phone Number' as check_type,
  upn.id,
  upn.phone_number,
  upn.is_active,
  upn.voicemail_enabled,
  upn.workspace_id
FROM public.user_phone_numbers upn
JOIN public.workspaces w ON w.id = upn.workspace_id
JOIN auth.users u ON u.id = w.owner_user_id
WHERE u.email = :'test_user_email'
  AND upn.is_active = TRUE
LIMIT 1;

-- 3. Check aloha_settings exists
SELECT 
  'Aloha Settings' as check_type,
  as_settings.id,
  as_settings.workspace_id,
  as_settings.ai_enabled,
  as_settings.greeting_message,
  as_settings.voicemail_message
FROM public.aloha_settings as_settings
JOIN public.workspaces w ON w.id = as_settings.workspace_id
JOIN auth.users u ON u.id = w.owner_user_id
WHERE u.email = :'test_user_email'
LIMIT 1;

-- 4. Summary
SELECT 
  'Summary' as check_type,
  COUNT(DISTINCT w.id) as workspace_count,
  COUNT(DISTINCT upn.id) FILTER (WHERE upn.is_active = TRUE) as active_phone_count,
  COUNT(DISTINCT as_settings.id) as settings_count
FROM public.workspaces w
JOIN auth.users u ON u.id = w.owner_user_id
LEFT JOIN public.user_phone_numbers upn ON upn.workspace_id = w.id
LEFT JOIN public.aloha_settings as_settings ON as_settings.workspace_id = w.id
WHERE u.email = :'test_user_email';




