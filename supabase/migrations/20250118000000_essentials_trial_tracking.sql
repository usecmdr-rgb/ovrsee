-- Migration to add Essentials trial tracking
-- Essentials is the only plan with a 3-day free trial
-- This column tracks if a user has used their Essentials trial

-- Add has_used_essentials_trial column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'has_used_essentials_trial'
  ) THEN
    ALTER TABLE profiles ADD COLUMN has_used_essentials_trial boolean NOT NULL DEFAULT false;
    
    -- Create index for efficient lookups
    CREATE INDEX IF NOT EXISTS idx_profiles_has_used_essentials_trial 
    ON profiles(has_used_essentials_trial) 
    WHERE has_used_essentials_trial = true;
    
    -- Comment explaining the column
    COMMENT ON COLUMN profiles.has_used_essentials_trial IS 
    'Tracks if user has used their 3-day Essentials trial. Only Essentials plan includes a free trial. This flag prevents trial reuse and is never reset.';
  END IF;
END $$;



