-- Add full_name column to business_profiles for user's name
-- This allows AI agents to use the user's name from business profile

ALTER TABLE business_profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT;

COMMENT ON COLUMN business_profiles.full_name IS 'Full name of the business owner/user for use in email signatures and AI responses';


