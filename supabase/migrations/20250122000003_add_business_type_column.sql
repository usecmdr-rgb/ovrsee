-- Add business_type column to business_profiles if it doesn't exist
-- This fixes the PGRST204 error when saving business profiles

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profiles' 
    AND column_name = 'business_type'
  ) THEN
    ALTER TABLE business_profiles ADD COLUMN business_type TEXT;
    COMMENT ON COLUMN business_profiles.business_type IS 'Industry/type of business';
  END IF;
END $$;


