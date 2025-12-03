-- Ensure trial tracking columns exist in profiles table
-- This migration explicitly adds columns that may be missing

-- Add has_used_trial column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'has_used_trial'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN has_used_trial BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;
END $$;

-- Add trial_used_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'trial_used_at'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN trial_used_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add email_normalized column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'email_normalized'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN email_normalized TEXT;
        
        -- Create index for fast lookups by normalized email
        CREATE INDEX IF NOT EXISTS idx_profiles_email_normalized 
        ON public.profiles(email_normalized) 
        WHERE deleted_at IS NULL;
    END IF;
END $$;

-- Add deleted_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;





