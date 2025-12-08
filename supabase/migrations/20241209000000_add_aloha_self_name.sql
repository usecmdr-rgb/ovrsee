-- Add aloha_self_name column to aloha_profiles table
-- This stores the custom name the agent should call itself (defaults to "Aloha" if empty)

ALTER TABLE aloha_profiles
ADD COLUMN IF NOT EXISTS aloha_self_name TEXT;

-- Add comment
COMMENT ON COLUMN aloha_profiles.aloha_self_name IS 'Custom name the agent calls itself. If empty or null, defaults to "Aloha".';






