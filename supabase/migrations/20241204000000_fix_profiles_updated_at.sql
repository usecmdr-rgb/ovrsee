-- Fix profiles.updated_at column if missing
-- This migration ensures the updated_at column exists on profiles table

DO $$
BEGIN
  -- Check if updated_at column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    
    -- Create index for updated_at if it doesn't exist
    CREATE INDEX IF NOT EXISTS idx_profiles_updated_at 
    ON public.profiles(updated_at);
    
    RAISE NOTICE 'Added updated_at column to profiles table';
  ELSE
    RAISE NOTICE 'updated_at column already exists on profiles table';
  END IF;
END $$;

-- Ensure the trigger function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists (will recreate if needed)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


