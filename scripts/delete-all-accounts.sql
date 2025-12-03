-- WARNING: This will delete ALL user data from your database!
-- This does NOT delete auth.users - you must do that through Supabase Dashboard
-- or use the Supabase Admin API

-- Delete in order to respect foreign key constraints:

-- 1. Delete workspace seats (references users)
DELETE FROM workspace_seats;

-- 2. Delete workspaces (references users)
DELETE FROM workspaces;

-- 3. Delete subscriptions (references users)
DELETE FROM subscriptions;

-- 4. Delete profiles (references auth.users)
DELETE FROM profiles;

-- 5. Delete other user-related data
DELETE FROM agent_conversations;
DELETE FROM agent_messages;
DELETE FROM user_phone_numbers;
DELETE FROM gmail_connections;
DELETE FROM calendar_connections;
DELETE FROM contact_profiles;
DELETE FROM business_profiles;
DELETE FROM business_knowledge_chunks;
DELETE FROM email_queue;

-- IMPORTANT: After running this, you MUST delete auth users through:
-- 1. Supabase Dashboard → Authentication → Users → Delete each user
-- OR
-- 2. Use Supabase Admin API (requires service role key)

-- To delete a specific user's data by email:
-- First get their user ID:
-- SELECT id FROM auth.users WHERE email = 'user@example.com';
-- Then delete their data using that ID

