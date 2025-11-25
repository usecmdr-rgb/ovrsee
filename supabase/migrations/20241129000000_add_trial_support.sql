-- Migration: Add 3-day free trial support
-- This migration adds trial tier and expired status to the subscription system

-- ============================================================================
-- 1. UPDATE SUBSCRIPTIONS TABLE
-- ============================================================================

-- Add 'trial' and 'trial_expired' to tier enum
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_tier_check 
  CHECK (tier IN ('free', 'trial', 'trial_expired', 'basic', 'advanced', 'elite'));

-- Add 'expired' to status enum
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check 
  CHECK (status IN ('active', 'trialing', 'expired', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid'));

-- Add trial_started_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'trial_started_at'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN trial_started_at TIMESTAMPTZ;
  END IF;
END $$;

-- Ensure trial_start and trial_end are properly named (trial_started_at and trial_ends_at)
-- Rename trial_start to trial_started_at if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'trial_start'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'trial_started_at'
  ) THEN
    ALTER TABLE public.subscriptions RENAME COLUMN trial_start TO trial_started_at;
  END IF;
END $$;

-- Rename trial_end to trial_ends_at if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'trial_end'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE public.subscriptions RENAME COLUMN trial_end TO trial_ends_at;
  END IF;
END $$;

-- Add trial_ends_at if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN trial_ends_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- 2. UPDATE PROFILES TABLE
-- ============================================================================

-- Add 'trial' and 'trial_expired' to tier enum
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_tier_check 
  CHECK (subscription_tier IN ('free', 'trial', 'trial_expired', 'basic', 'advanced', 'elite') OR subscription_tier IS NULL);

-- Add 'expired' to status enum
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check 
  CHECK (subscription_status IN ('active', 'trialing', 'expired', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid') OR subscription_status IS NULL);

-- Add trial_started_at if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'trial_started_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN trial_started_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- 3. UPDATE AUTO-CREATE USER TRIGGER
-- ============================================================================

-- Update the trigger function to create trial subscription instead of free
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create 3-day free trial subscription
  INSERT INTO public.subscriptions (
    user_id, 
    tier, 
    status, 
    trial_started_at, 
    trial_ends_at
  )
  VALUES (
    NEW.id, 
    'trial', 
    'active',
    NOW(),
    NOW() + INTERVAL '3 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. CREATE FUNCTION TO CHECK AND EXPIRE TRIALS
-- ============================================================================

-- Function to check and expire trials that have passed their end date
CREATE OR REPLACE FUNCTION public.check_trial_expiration()
RETURNS void AS $$
BEGIN
  -- Update subscriptions where trial has expired and no paid subscription exists
  UPDATE public.subscriptions
  SET 
    tier = 'trial_expired',
    status = 'expired',
    updated_at = NOW()
  WHERE 
    tier = 'trial'
    AND status = 'active'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW()
    AND (stripe_subscription_id IS NULL OR stripe_subscription_id = '');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. CREATE INDEX FOR TRIAL EXPIRATION CHECKS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_expiration 
  ON public.subscriptions(tier, status, trial_ends_at) 
  WHERE tier = 'trial' AND status = 'active';

-- ============================================================================
-- 6. UPDATE SYNC TRIGGER TO HANDLE TRIAL FIELDS
-- ============================================================================

-- Update the sync function to include trial fields
CREATE OR REPLACE FUNCTION public.sync_profile_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profile subscription fields when subscription changes
  UPDATE public.profiles
  SET
    subscription_tier = NEW.tier,
    subscription_status = NEW.status,
    stripe_customer_id = COALESCE(NEW.stripe_customer_id, profiles.stripe_customer_id),
    stripe_subscription_id = COALESCE(NEW.stripe_subscription_id, profiles.stripe_subscription_id),
    trial_ends_at = NEW.trial_ends_at,
    trial_started_at = NEW.trial_started_at,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

