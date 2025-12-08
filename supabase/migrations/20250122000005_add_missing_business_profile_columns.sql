-- Add missing columns to business_profiles if they don't exist
-- This fixes PGRST204 errors when saving business profiles

DO $$
BEGIN
  -- Add description if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profiles' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE business_profiles ADD COLUMN description TEXT;
    COMMENT ON COLUMN business_profiles.description IS 'Business description';
  END IF;

  -- Add contact_email if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profiles' 
    AND column_name = 'contact_email'
  ) THEN
    ALTER TABLE business_profiles ADD COLUMN contact_email TEXT;
    COMMENT ON COLUMN business_profiles.contact_email IS 'Business contact email address';
  END IF;

  -- Add contact_phone if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profiles' 
    AND column_name = 'contact_phone'
  ) THEN
    ALTER TABLE business_profiles ADD COLUMN contact_phone TEXT;
    COMMENT ON COLUMN business_profiles.contact_phone IS 'Business contact phone number';
  END IF;

  -- Add full_name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profiles' 
    AND column_name = 'full_name'
  ) THEN
    ALTER TABLE business_profiles ADD COLUMN full_name TEXT;
    COMMENT ON COLUMN business_profiles.full_name IS 'Full name of the business owner/user for use in email signatures and AI responses';
  END IF;

  -- Add service_area if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profiles' 
    AND column_name = 'service_area'
  ) THEN
    ALTER TABLE business_profiles ADD COLUMN service_area TEXT;
    COMMENT ON COLUMN business_profiles.service_area IS 'Service area or coverage area';
  END IF;

  -- Add hours_of_operation if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profiles' 
    AND column_name = 'hours_of_operation'
  ) THEN
    ALTER TABLE business_profiles ADD COLUMN hours_of_operation TEXT;
    COMMENT ON COLUMN business_profiles.hours_of_operation IS 'Operating hours (e.g., "Mon-Fri 9am-5pm")';
  END IF;
END $$;

