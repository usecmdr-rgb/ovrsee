-- Add trial tracking columns to profiles table
-- This ensures users can only use the free trial once, even if they delete their account
-- and sign up again with the same email.

DO $$ 
BEGIN
    -- Add has_used_trial column if it doesn't exist
    -- This flag is NEVER reset, even if user cancels or deletes account
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'has_used_trial'
    ) THEN
        ALTER TABLE profiles ADD COLUMN has_used_trial BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add trial_used_at column if it doesn't exist
    -- Tracks when the trial was first used (for audit purposes)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'trial_used_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN trial_used_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add deleted_at column for soft deletion
    -- This allows us to preserve trial history even if user "deletes" account
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add email_normalized column for consistent email lookups
    -- This ensures trial checks work regardless of email case variations
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'email_normalized'
    ) THEN
        ALTER TABLE profiles ADD COLUMN email_normalized TEXT;
        
        -- Create index for fast lookups by normalized email
        CREATE INDEX IF NOT EXISTS idx_profiles_email_normalized 
        ON profiles(email_normalized) 
        WHERE deleted_at IS NULL;
    END IF;
END $$;

-- Create a function to normalize email addresses
-- This ensures consistent email comparison (lowercase, trimmed)
CREATE OR REPLACE FUNCTION normalize_email(email TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(TRIM(email));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing profiles to set email_normalized
UPDATE profiles 
SET email_normalized = normalize_email(
    (SELECT email FROM auth.users WHERE auth.users.id = profiles.id LIMIT 1)
)
WHERE email_normalized IS NULL;

-- Add comment explaining the trial tracking system
COMMENT ON COLUMN profiles.has_used_trial IS 
'Flag indicating if this email has ever used the free trial. This is NEVER reset, even if account is deleted, to prevent trial abuse.';
COMMENT ON COLUMN profiles.trial_used_at IS 
'Timestamp when the free trial was first used. Used for audit and to prevent multiple trials.';
COMMENT ON COLUMN profiles.deleted_at IS 
'Soft deletion timestamp. When set, account is considered deleted but data is preserved for trial tracking.';
COMMENT ON COLUMN profiles.email_normalized IS 
'Normalized (lowercase, trimmed) email address for consistent trial eligibility checks across account recreations.';

