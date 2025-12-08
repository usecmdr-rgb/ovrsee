-- Feature-gating backend schema migration
-- This migration introduces the new pricing model with plan_code, feature_code, addon_code enums
-- and establishes feature gating infrastructure

-- ============================================================================
-- 1. CREATE ENUMS
-- ============================================================================

-- Plan codes (matching new pricing model: essentials, professional, executive, teams)
CREATE TYPE plan_code AS ENUM ('essentials', 'professional', 'executive', 'teams');

-- Feature codes (for feature gating)
CREATE TYPE feature_code AS ENUM (
  'sync',
  'aloha',
  'studio',
  'insight',
  'support_standard',
  'support_priority'
);

-- Add-on codes (only for Essentials tier)
CREATE TYPE addon_code AS ENUM ('aloha_addon', 'studio_addon');

-- ============================================================================
-- 2. UPDATE PROFILES TABLE
-- ============================================================================

-- Add new columns to profiles table (if they don't exist)
DO $$
BEGIN
  -- Add default_plan column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'default_plan'
  ) THEN
    ALTER TABLE profiles ADD COLUMN default_plan plan_code;
  END IF;

  -- Add default_payment_method_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'default_payment_method_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN default_payment_method_id text;
  END IF;

  -- stripe_customer_id should already exist, but ensure it does
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_customer_id text;
  END IF;
END $$;

-- ============================================================================
-- 3. UPDATE SUBSCRIPTIONS TABLE
-- ============================================================================

-- Migrate existing subscriptions table to use plan_code enum
-- First, create a new subscriptions table with the proper structure
-- We'll migrate data from old to new structure

-- Create new subscriptions table with plan_code enum
CREATE TABLE IF NOT EXISTS subscriptions_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL UNIQUE,
  plan plan_code NOT NULL,
  status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS subscriptions_new_user_idx ON subscriptions_new(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_new_stripe_idx ON subscriptions_new(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS subscriptions_new_status_idx ON subscriptions_new(status);

-- Migrate data from old subscriptions table if it exists
DO $$
DECLARE
  rec record;
BEGIN
  -- Check if old subscriptions table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'subscriptions') THEN
    
    -- Migrate existing subscriptions, mapping old tier values to new plan_code
    FOR rec IN 
      SELECT 
        id,
        user_id,
        COALESCE(stripe_subscription_id, '') as stripe_sub_id,
        CASE 
          WHEN tier = 'basic' THEN 'essentials'::plan_code
          WHEN tier = 'advanced' THEN 'professional'::plan_code
          WHEN tier = 'elite' THEN 'executive'::plan_code
          WHEN tier = 'free' THEN 'essentials'::plan_code
          ELSE 'essentials'::plan_code
        END as new_plan,
        status,
        COALESCE(current_period_start, now()) as period_start,
        COALESCE(current_period_end, now() + interval '1 month') as period_end,
        COALESCE(cancel_at_period_end, false) as cancel_at_end
      FROM subscriptions
      WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id != ''
    LOOP
      INSERT INTO subscriptions_new (
        id,
        user_id,
        stripe_subscription_id,
        plan,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        created_at,
        updated_at
      ) VALUES (
        rec.id,
        rec.user_id,
        rec.stripe_sub_id,
        rec.new_plan,
        rec.status,
        rec.period_start,
        rec.period_end,
        rec.cancel_at_end,
        now(),
        now()
      )
      ON CONFLICT (stripe_subscription_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Drop old subscriptions table and rename new one
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'subscriptions') THEN
    -- Drop old table (this will cascade to any foreign keys)
    DROP TABLE IF EXISTS subscriptions CASCADE;
  END IF;
  
  -- Rename new table
  ALTER TABLE subscriptions_new RENAME TO subscriptions;
  
  -- Rename indexes
  ALTER INDEX subscriptions_new_user_idx RENAME TO subscriptions_user_idx;
  ALTER INDEX subscriptions_new_stripe_idx RENAME TO subscriptions_stripe_idx;
  ALTER INDEX subscriptions_new_status_idx RENAME TO subscriptions_status_idx;
END $$;

-- ============================================================================
-- 4. CREATE SUBSCRIPTION ADDONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  addon addon_code NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, addon)
);

CREATE INDEX IF NOT EXISTS subscription_addons_subscription_idx ON subscription_addons(subscription_id);

-- ============================================================================
-- 5. CREATE PLAN FEATURES TABLE (for quick feature gating)
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan plan_code NOT NULL,
  feature feature_code NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan, feature)
);

CREATE INDEX IF NOT EXISTS plan_features_plan_idx ON plan_features(plan);
CREATE INDEX IF NOT EXISTS plan_features_feature_idx ON plan_features(feature);

-- Seed plan_features table
-- Essentials plan features
INSERT INTO plan_features(plan, feature) VALUES
('essentials', 'sync'),
('essentials', 'support_standard')
ON CONFLICT (plan, feature) DO NOTHING;

-- Professional plan features
INSERT INTO plan_features(plan, feature) VALUES
('professional', 'sync'),
('professional', 'aloha'),
('professional', 'studio'),
('professional', 'support_priority')
ON CONFLICT (plan, feature) DO NOTHING;

-- Executive plan features
INSERT INTO plan_features(plan, feature) VALUES
('executive', 'sync'),
('executive', 'aloha'),
('executive', 'studio'),
('executive', 'insight'),
('executive', 'support_priority')
ON CONFLICT (plan, feature) DO NOTHING;

-- Teams plan features (all features enabled)
INSERT INTO plan_features(plan, feature) VALUES
('teams', 'sync'),
('teams', 'aloha'),
('teams', 'studio'),
('teams', 'insight'),
('teams', 'support_priority')
ON CONFLICT (plan, feature) DO NOTHING;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;

-- Subscription addons policies
DROP POLICY IF EXISTS "Users can view own subscription addons" ON subscription_addons;
CREATE POLICY "Users can view own subscription addons"
  ON subscription_addons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.id = subscription_addons.subscription_id
      AND subscriptions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own subscription addons" ON subscription_addons;
CREATE POLICY "Users can insert own subscription addons"
  ON subscription_addons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.id = subscription_addons.subscription_id
      AND subscriptions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own subscription addons" ON subscription_addons;
CREATE POLICY "Users can delete own subscription addons"
  ON subscription_addons FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.id = subscription_addons.subscription_id
      AND subscriptions.user_id = auth.uid()
    )
  );

-- Plan features policies (read-only for all authenticated users)
DROP POLICY IF EXISTS "Authenticated users can view plan features" ON plan_features;
CREATE POLICY "Authenticated users can view plan features"
  ON plan_features FOR SELECT
  USING (auth.role() = 'authenticated');

-- Update subscriptions RLS policies (if subscriptions table was recreated)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'subscriptions') THEN
    -- Enable RLS
    ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
    DROP POLICY IF EXISTS "Users can update own subscription" ON subscriptions;
    DROP POLICY IF EXISTS "Users can insert own subscription" ON subscriptions;

    -- Create new policies
    CREATE POLICY "Users can view own subscription"
      ON subscriptions FOR SELECT
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can update own subscription"
      ON subscriptions FOR UPDATE
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can insert own subscription"
      ON subscriptions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Trigger to update updated_at on subscriptions
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 8. HELPER FUNCTIONS (for feature gating)
-- ============================================================================

-- Function to get active subscription for a user
CREATE OR REPLACE FUNCTION get_active_subscription_for_user(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  stripe_subscription_id text,
  plan plan_code,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.stripe_subscription_id,
    s.plan,
    s.status,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end
  FROM subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has a specific feature
CREATE OR REPLACE FUNCTION user_has_feature(p_user_id uuid, p_feature feature_code)
RETURNS boolean AS $$
DECLARE
  v_subscription_record record;
  v_has_base_feature boolean;
  v_plan plan_code;
  v_addon_record record;
BEGIN
  -- Get active subscription
  SELECT * INTO v_subscription_record
  FROM get_active_subscription_for_user(p_user_id)
  LIMIT 1;

  -- If no active subscription, return false
  IF v_subscription_record IS NULL THEN
    RETURN false;
  END IF;

  v_plan := v_subscription_record.plan;

  -- Check if plan has the base feature
  SELECT enabled INTO v_has_base_feature
  FROM plan_features
  WHERE plan = v_plan
    AND feature = p_feature
  LIMIT 1;

  -- If base plan has feature, return true
  IF v_has_base_feature = true THEN
    RETURN true;
  END IF;

  -- For Essentials plan, check addons
  IF v_plan = 'essentials' THEN
    -- Check for Aloha addon
    IF p_feature = 'aloha' THEN
      SELECT 1 INTO v_addon_record
      FROM subscription_addons sa
      WHERE sa.subscription_id = v_subscription_record.id
        AND sa.addon = 'aloha_addon'
      LIMIT 1;
      
      IF v_addon_record IS NOT NULL THEN
        RETURN true;
      END IF;
    END IF;

    -- Check for Studio addon
    IF p_feature = 'studio' THEN
      SELECT 1 INTO v_addon_record
      FROM subscription_addons sa
      WHERE sa.subscription_id = v_subscription_record.id
        AND sa.addon = 'studio_addon'
      LIMIT 1;
      
      IF v_addon_record IS NOT NULL THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  -- Feature not found
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_active_subscription_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_feature(uuid, feature_code) TO authenticated;




