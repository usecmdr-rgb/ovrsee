-- Migration: 20241127000000_add_subscription_columns.sql
-- ============================================================================
-- Add subscription columns to profiles table if they don't exist
-- This migration ensures the profiles table has the necessary columns for subscription management

DO $$ 
BEGIN
    -- Add subscription_tier column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'subscription_tier'
    ) THEN
        ALTER TABLE profiles ADD COLUMN subscription_tier TEXT;
    END IF;

    -- Add subscription_status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE profiles ADD COLUMN subscription_status TEXT;
    END IF;

    -- Add stripe_customer_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id'
    ) THEN
        ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
    END IF;

    -- Add stripe_subscription_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'stripe_subscription_id'
    ) THEN
        ALTER TABLE profiles ADD COLUMN stripe_subscription_id TEXT;
    END IF;
END $$;



-- ============================================================================
-- Migration: 20241128000000_add_trial_tracking.sql
-- ============================================================================
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
-- Note: This requires the auth.users table to be accessible
-- If this fails, email_normalized will be set when users next interact with the system
UPDATE profiles 
SET email_normalized = LOWER(TRIM(
    (SELECT email FROM auth.users WHERE auth.users.id = profiles.id LIMIT 1)
))
WHERE email_normalized IS NULL 
  AND EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = profiles.id);

-- Add comment explaining the trial tracking system
COMMENT ON COLUMN profiles.has_used_trial IS 
'Flag indicating if this email has ever used the free trial. This is NEVER reset, even if account is deleted, to prevent trial abuse.';
COMMENT ON COLUMN profiles.trial_used_at IS 
'Timestamp when the free trial was first used. Used for audit and to prevent multiple trials.';
COMMENT ON COLUMN profiles.deleted_at IS 
'Soft deletion timestamp. When set, account is considered deleted but data is preserved for trial tracking.';
COMMENT ON COLUMN profiles.email_normalized IS 
'Normalized (lowercase, trimmed) email address for consistent trial eligibility checks across account recreations.';



-- ============================================================================
-- Migration: 20241128000000_comprehensive_subscription_schema.sql
-- ============================================================================
-- Comprehensive subscription-aware data handling migration
-- This migration ensures all tables exist and are properly configured for subscription management

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PROFILES TABLE
-- ============================================================================
-- Profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Subscription fields (kept for backward compatibility, but subscriptions table is primary)
  subscription_tier TEXT CHECK (subscription_tier IN ('free', 'basic', 'advanced', 'elite')),
  subscription_status TEXT CHECK (subscription_status IN ('active', 'trialing', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for profiles (only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email') THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'stripe_customer_id') THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'stripe_subscription_id') THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id ON public.profiles(stripe_subscription_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_tier') THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON public.profiles(subscription_tier);
  END IF;
END $$;

-- ============================================================================
-- 2. SUBSCRIPTIONS TABLE (Normalized subscription data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'basic', 'advanced', 'elite')),
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Only one active subscription per user
  CONSTRAINT subscriptions_user_id_unique UNIQUE(user_id)
);

-- Create indexes for subscriptions (only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'stripe_customer_id') THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'stripe_subscription_id') THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'tier') THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON public.subscriptions(tier);
  END IF;
END $$;

-- ============================================================================
-- 3. AGENTS TABLE
-- ============================================================================
-- Agents table (per-user agent configurations or system agents)
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('aloha', 'studio', 'sync', 'insight')),
  name TEXT,
  settings JSONB DEFAULT '{}',
  prompt TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for agents (only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agents_user_id ON public.agents(user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'agent_type') THEN
    CREATE INDEX IF NOT EXISTS idx_agents_agent_type ON public.agents(agent_type);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'user_id') 
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'agent_type') THEN
    CREATE INDEX IF NOT EXISTS idx_agents_user_agent_type ON public.agents(user_id, agent_type);
  END IF;
END $$;

-- ============================================================================
-- 4. AGENT CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('aloha', 'studio', 'sync', 'insight')),
  title TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for agent_conversations (only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_conversations' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_id ON public.agent_conversations(user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_conversations' AND column_name = 'agent_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_id ON public.agent_conversations(agent_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_conversations' AND column_name = 'agent_type') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_type ON public.agent_conversations(agent_type);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_conversations' AND column_name = 'user_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_conversations' AND column_name = 'agent_type')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_conversations' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_agent_created ON public.agent_conversations(user_id, agent_type, created_at DESC);
  END IF;
END $$;

-- ============================================================================
-- 5. AGENT MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for agent_messages (only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_messages' AND column_name = 'conversation_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_id ON public.agent_messages(conversation_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_messages' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_messages_user_id ON public.agent_messages(user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_messages' AND column_name = 'conversation_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_messages' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_created ON public.agent_messages(conversation_id, created_at DESC);
  END IF;
END $$;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view own profile" ON public.public CASCADE;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update own profile" ON public.public CASCADE;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert own profile" ON public.public CASCADE;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Subscriptions policies
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view own subscription" ON public.public CASCADE;
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update own subscription" ON public.public CASCADE;
CREATE POLICY "Users can update own subscription"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.public CASCADE;
CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Agents policies (only if user_id column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'user_id') THEN
    -- Drop policy if exists
DROP POLICY IF EXISTS "Users can view own agents" ON public.agents CASCADE;
    EXECUTE '-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view own agents" ON public.public CASCADE;
CREATE POLICY "Users can view own agents" ON public.agents FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL)';
    
    -- Drop policy if exists
DROP POLICY IF EXISTS "Users can update own agents" ON public.agents CASCADE;
    EXECUTE '-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update own agents" ON public.public CASCADE;
CREATE POLICY "Users can update own agents" ON public.agents FOR UPDATE USING (auth.uid() = user_id)';
    
    -- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert own agents" ON public.agents CASCADE;
    EXECUTE '-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert own agents" ON public.public CASCADE;
CREATE POLICY "Users can insert own agents" ON public.agents FOR INSERT WITH CHECK (auth.uid() = user_id)';
    
    -- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete own agents" ON public.agents CASCADE;
    EXECUTE '-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete own agents" ON public.public CASCADE;
CREATE POLICY "Users can delete own agents" ON public.agents FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $$;

-- Agent conversations policies (only if user_id column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_conversations' AND column_name = 'user_id') THEN
    -- Drop policy if exists
DROP POLICY IF EXISTS "Users can view own conversations" ON public.agent_conversations CASCADE;
    EXECUTE '-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view own conversations" ON public.public CASCADE;
CREATE POLICY "Users can view own conversations" ON public.agent_conversations FOR SELECT USING (auth.uid() = user_id)';
    
    -- Drop policy if exists
DROP POLICY IF EXISTS "Users can update own conversations" ON public.agent_conversations CASCADE;
    EXECUTE '-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update own conversations" ON public.public CASCADE;
CREATE POLICY "Users can update own conversations" ON public.agent_conversations FOR UPDATE USING (auth.uid() = user_id)';
    
    -- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.agent_conversations CASCADE;
    EXECUTE '-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.public CASCADE;
CREATE POLICY "Users can insert own conversations" ON public.agent_conversations FOR INSERT WITH CHECK (auth.uid() = user_id)';
    
    -- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.agent_conversations CASCADE;
    EXECUTE '-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.public CASCADE;
CREATE POLICY "Users can delete own conversations" ON public.agent_conversations FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $$;

-- Agent messages policies (only if user_id column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_messages' AND column_name = 'user_id') THEN
    -- Drop policy if exists
DROP POLICY IF EXISTS "Users can view own messages" ON public.agent_messages CASCADE;
    EXECUTE '-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view own messages" ON public.public CASCADE;
CREATE POLICY "Users can view own messages" ON public.agent_messages FOR SELECT USING (auth.uid() = user_id)';
    
    -- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert own messages" ON public.agent_messages CASCADE;
    EXECUTE '-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert own messages" ON public.public CASCADE;
CREATE POLICY "Users can insert own messages" ON public.agent_messages FOR INSERT WITH CHECK (auth.uid() = user_id)';
    
    -- Drop policy if exists
DROP POLICY IF EXISTS "Users can update own messages" ON public.agent_messages CASCADE;
    EXECUTE '-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update own messages" ON public.public CASCADE;
CREATE POLICY "Users can update own messages" ON public.agent_messages FOR UPDATE USING (auth.uid() = user_id)';
    
    -- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete own messages" ON public.agent_messages CASCADE;
    EXECUTE '-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete own messages" ON public.public CASCADE;
CREATE POLICY "Users can delete own messages" ON public.agent_messages FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $$;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_agents_updated_at ON public.agents;
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_conversations_updated_at ON public.agent_conversations;
CREATE TRIGGER update_agent_conversations_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 8. AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================================================
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

  -- Create default free subscription
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call function on new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 9. SYNC PROFILE SUBSCRIPTION public.FIELDS WITH SUBSCRIPTIONS TABLE
-- ============================================================================
-- Function to keep profiles.subscription_tier and subscription_status in sync with subscriptions table
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
    trial_ends_at = NEW.trial_end,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync on subscription insert/update
DROP TRIGGER IF EXISTS sync_profile_on_subscription_change ON public.subscriptions;
CREATE TRIGGER sync_profile_on_subscription_change
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_subscription();



-- ============================================================================
-- Migration: 20241129000000_add_trial_support.sql
-- ============================================================================
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



-- ============================================================================
-- Migration: 20241129000000_business_profile_knowledge.sql
-- ============================================================================
-- Business Profile and Knowledge Layer
-- This migration creates tables for storing business information and knowledge chunks
-- that all AI agents can access and use

-- Business Profiles table
-- Stores the main business information for each user
CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic business information
  business_name TEXT,
  business_type TEXT, -- industry/type
  description TEXT,
  
  -- Contact and location
  primary_website_url TEXT,
  additional_urls JSONB DEFAULT '[]'::jsonb, -- Array of additional website URLs
  location TEXT,
  service_area TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  
  -- Services and operations
  services_offered JSONB, -- Can be array or structured object
  hours_of_operation TEXT, -- e.g., "Mon-Fri, 8a-6p"
  service_name TEXT, -- Product/service name
  
  -- Preferences (for Studio agent and others)
  image_watermark_enabled BOOLEAN DEFAULT FALSE,
  image_watermark_text TEXT,
  image_watermark_logo_url TEXT,
  image_watermark_position TEXT CHECK (image_watermark_position IN ('top_left', 'top_right', 'bottom_left', 'bottom_right', 'center', 'top_center', 'bottom_center')),
  
  -- Additional preferences (can be extended)
  preferences JSONB DEFAULT '{}'::jsonb,
  
  -- Language and timezone
  language TEXT DEFAULT 'English',
  timezone TEXT DEFAULT 'EST',
  
  -- Notes and special instructions
  notes TEXT, -- "Help us, help you" notes
  
  -- Website crawling metadata
  last_crawled_at TIMESTAMP WITH TIME ZONE,
  crawl_status TEXT DEFAULT 'pending' CHECK (crawl_status IN ('pending', 'in_progress', 'completed', 'failed')),
  crawl_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one profile per user
  UNIQUE(user_id)
);

-- Business Knowledge Chunks table
-- Stores structured knowledge extracted from forms and websites
CREATE TABLE IF NOT EXISTS business_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  
  -- Source information
  source TEXT NOT NULL CHECK (source IN ('form', 'website', 'manual')),
  source_url TEXT, -- For website pages, nullable for form/manual entries
  
  -- Content
  title TEXT, -- Page title or chunk title
  content TEXT NOT NULL, -- Cleaned and summarized content
  
  -- Optional: Vector embeddings for semantic search (if RAG is added later)
  embedding vector(1536), -- OpenAI embedding dimension
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata (page depth, crawl order, etc.)
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id ON business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_website ON business_profiles(primary_website_url) WHERE primary_website_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_knowledge_chunks_profile_id ON business_knowledge_chunks(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_business_knowledge_chunks_source ON business_knowledge_chunks(source);
CREATE INDEX IF NOT EXISTS idx_business_knowledge_chunks_source_url ON business_knowledge_chunks(source_url) WHERE source_url IS NOT NULL;

-- GIN index for JSONB searches
CREATE INDEX IF NOT EXISTS idx_business_profiles_additional_urls ON public.business_profiles USING GIN(additional_urls);
CREATE INDEX IF NOT EXISTS idx_business_profiles_preferences ON public.business_profiles USING GIN(preferences);
CREATE INDEX IF NOT EXISTS idx_business_knowledge_chunks_metadata ON public.business_knowledge_chunks USING GIN(metadata);

-- Vector index for embeddings (if pgvector extension is available)
-- CREATE INDEX IF NOT EXISTS idx_business_knowledge_chunks_embedding ON public.business_knowledge_chunks USING ivfflat(embedding vector_cosine_ops);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_business_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_business_knowledge_chunks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_business_profiles_updated_at ON business_profiles;
CREATE TRIGGER trigger_update_business_profiles_updated_at
  BEFORE UPDATE ON public.business_profiles FOR EACH ROW
  EXECUTE FUNCTION update_business_profiles_updated_at();

DROP TRIGGER IF EXISTS trigger_update_business_knowledge_chunks_updated_at ON business_knowledge_chunks;
CREATE TRIGGER trigger_update_business_knowledge_chunks_updated_at
  BEFORE UPDATE ON public.business_knowledge_chunks FOR EACH ROW
  EXECUTE FUNCTION update_business_knowledge_chunks_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own business profile
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view their own business profile" ON public.business_profiles CASCADE;
CREATE POLICY "Users can view their own business profile"
  ON public.business_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert their own business profile" ON public.business_profiles CASCADE;
CREATE POLICY "Users can insert their own business profile"
  ON public.business_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update their own business profile" ON public.business_profiles CASCADE;
CREATE POLICY "Users can update their own business profile"
  ON public.business_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete their own business profile" ON public.business_profiles CASCADE;
CREATE POLICY "Users can delete their own business profile"
  ON public.business_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for knowledge chunks
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view knowledge chunks for their business profile" ON public.business_knowledge_chunks CASCADE;
CREATE POLICY "Users can view knowledge chunks for their business profile"
  ON public.business_knowledge_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE business_profiles.id = business_knowledge_chunks.business_profile_id
      AND business_profiles.user_id = auth.uid()
    )
  );

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert knowledge chunks for their business profile" ON public.business_knowledge_chunks CASCADE;
CREATE POLICY "Users can insert knowledge chunks for their business profile"
  ON public.business_knowledge_chunks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE business_profiles.id = business_knowledge_chunks.business_profile_id
      AND business_profiles.user_id = auth.uid()
    )
  );

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update knowledge chunks for their business profile" ON public.business_knowledge_chunks CASCADE;
CREATE POLICY "Users can update knowledge chunks for their business profile"
  ON public.business_knowledge_chunks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE business_profiles.id = business_knowledge_chunks.business_profile_id
      AND business_profiles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE business_profiles.id = business_knowledge_chunks.business_profile_id
      AND business_profiles.user_id = auth.uid()
    )
  );

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete knowledge chunks for their business profile" ON public.business_knowledge_chunks CASCADE;
CREATE POLICY "Users can delete knowledge chunks for their business profile"
  ON public.business_knowledge_chunks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE business_profiles.id = business_knowledge_chunks.business_profile_id
      AND business_profiles.user_id = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE business_profiles IS 'Stores business information and preferences for each user. All AI agents can access this data.';
COMMENT ON TABLE business_knowledge_chunks IS 'Stores structured knowledge extracted from business forms and websites. Used by AI agents for context.';
COMMENT ON COLUMN business_profiles.image_watermark_position IS 'Position for image watermark: top_left, top_right, bottom_left, bottom_right, center, top_center, bottom_center';
COMMENT ON COLUMN business_knowledge_chunks.source IS 'Source of knowledge: form (from business info form), website (crawled), or manual (admin-added)';
COMMENT ON COLUMN business_knowledge_chunks.embedding IS 'Vector embedding for semantic search (optional, requires pgvector extension)';













-- ============================================================================
-- Migration: 20241130000000_add_data_retention.sql
-- ============================================================================
-- Migration: Add data retention windows for trial and canceled subscriptions
-- This migration adds fields to track data retention periods and implements
-- the logic for 30-day retention after trial expiration and 60-day retention
-- after paid subscription cancellation

-- ============================================================================
-- 1. ADD DATA RETENTION FIELDS TO SUBSCRIPTIONS TABLE
-- ============================================================================

-- Add trial_ended_at to track when trial actually ended
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'trial_ended_at'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN trial_ended_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add data_retention_expires_at to track when interaction data should be deleted
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'data_retention_expires_at'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN data_retention_expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add data_retention_reason to track why retention window was set
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'data_retention_reason'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN data_retention_reason TEXT 
      CHECK (data_retention_reason IN ('trial_expired', 'paid_canceled', 'paid_paused') OR data_retention_reason IS NULL);
  END IF;
END $$;

-- Add paid_canceled_at to track when paid subscription was canceled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'paid_canceled_at'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN paid_canceled_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add 'data_cleared' tier and 'inactive' status to support post-retention state
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_tier_check 
  CHECK (tier IN ('free', 'trial', 'trial_expired', 'data_cleared', 'basic', 'advanced', 'elite'));

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check 
  CHECK (status IN ('active', 'trialing', 'expired', 'canceled', 'paused', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid', 'inactive'));

-- Create indexes for retention queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_retention_expires 
  ON public.subscriptions(data_retention_expires_at) 
  WHERE data_retention_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_retention_reason 
  ON public.subscriptions(data_retention_reason) 
  WHERE data_retention_reason IS NOT NULL;

-- ============================================================================
-- 2. UPDATE PROFILES TABLE (for backward compatibility)
-- ============================================================================

-- Add same fields to profiles for sync
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'trial_ended_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN trial_ended_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'data_retention_expires_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN data_retention_expires_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'data_retention_reason'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN data_retention_reason TEXT;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'paid_canceled_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN paid_canceled_at TIMESTAMPTZ;
  END IF;
END $$;

-- Update profile tier/status constraints
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_tier_check 
  CHECK (subscription_tier IN ('free', 'trial', 'trial_expired', 'data_cleared', 'basic', 'advanced', 'elite') OR subscription_tier IS NULL);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check 
  CHECK (subscription_status IN ('active', 'trialing', 'expired', 'canceled', 'paused', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid', 'inactive') OR subscription_status IS NULL);

-- ============================================================================
-- 3. UPDATE TRIAL EXPIRATION FUNCTION TO SET RETENTION WINDOW
-- ============================================================================

-- Function to expire trial and set 30-day retention window
CREATE OR REPLACE FUNCTION public.expire_trial_with_retention(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.subscriptions
  SET 
    tier = 'trial_expired',
    status = 'expired',
    trial_ended_at = COALESCE(trial_ended_at, NOW()),
    data_retention_expires_at = COALESCE(
      data_retention_expires_at, 
      NOW() + INTERVAL '30 days'
    ),
    data_retention_reason = COALESCE(data_retention_reason, 'trial_expired'),
    updated_at = NOW()
  WHERE 
    user_id = user_id_param
    AND tier = 'trial'
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing check_trial_expiration to use retention
CREATE OR REPLACE FUNCTION public.check_trial_expiration()
RETURNS void AS $$
BEGIN
  -- Update subscriptions where trial has expired and no paid subscription exists
  UPDATE public.subscriptions
  SET 
    tier = 'trial_expired',
    status = 'expired',
    trial_ended_at = COALESCE(trial_ended_at, NOW()),
    data_retention_expires_at = COALESCE(
      data_retention_expires_at,
      NOW() + INTERVAL '30 days'
    ),
    data_retention_reason = COALESCE(data_retention_reason, 'trial_expired'),
    updated_at = NOW()
  WHERE 
    tier = 'trial'
    AND status = 'active'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW()
    AND (stripe_subscription_id IS NULL OR stripe_subscription_id = '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. FUNCTION TO SET RETENTION public.WINDOW FOR CANCELED PAID SUBSCRIPTIONS
-- ============================================================================

-- Function to set 60-day retention window when paid subscription is canceled/paused
CREATE OR REPLACE FUNCTION public.set_paid_cancellation_retention(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.subscriptions
  SET 
    paid_canceled_at = COALESCE(paid_canceled_at, NOW()),
    data_retention_expires_at = COALESCE(
      data_retention_expires_at,
      NOW() + INTERVAL '60 days'
    ),
    data_retention_reason = CASE
      WHEN status = 'paused' THEN 'paid_paused'
      ELSE 'paid_canceled'
    END,
    updated_at = NOW()
  WHERE 
    user_id = user_id_param
    AND tier IN ('basic', 'advanced', 'elite')
    AND status IN ('canceled', 'paused')
    AND stripe_subscription_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. FUNCTION TO CLEAR INTERACTION public.DATA FOR EXPIRED RETENTION
-- ============================================================================

-- Function to safely delete all interaction/memory data for a user
-- This preserves: auth.users, profiles, subscriptions, agents, has_used_trial flags, connections
-- 
-- DELETES (interaction/memory data):
-- - agent_messages: All chat messages
-- - agent_conversations: All conversations
-- - business_knowledge_chunks: AI knowledge/memory chunks (if exists)
-- - calendar_event_notes: Event notes/interactions (if exists)
--
-- PRESERVES (identity, config, history):
-- - auth.users: User authentication
-- - profiles: User profile
-- - subscriptions: Subscription history
-- - agents: Agent definitions/configurations
-- - has_used_trial: Trial usage flag
-- - gmail_connections: Connection configs (not interaction data)
-- - calendar_connections: Connection configs (not interaction data)
CREATE OR REPLACE FUNCTION public.clear_user_interaction_data(user_id_param UUID)
RETURNS void AS $$
BEGIN
  -- Delete agent messages (cascades from conversations, but explicit for clarity)
  DELETE FROM public.agent_messages
  WHERE user_id = user_id_param;

  -- Delete agent conversations
  DELETE FROM public.agent_conversations
  WHERE user_id = user_id_param;

  -- Delete business knowledge chunks (AI memory/knowledge)
  -- Linked via business_profile_id -> business_profiles -> user_id
  -- Only delete if tables exist
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'business_knowledge_chunks'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'business_profiles'
  ) THEN
    DELETE FROM public.business_knowledge_chunks
    WHERE business_profile_id IN (
      SELECT id FROM public.business_profiles WHERE user_id = user_id_param
    );
  END IF;

  -- Delete calendar event notes (interaction data)
  -- Only delete if table exists and has user_id column
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'calendar_event_notes'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'calendar_event_notes' 
      AND column_name = 'user_id'
    ) THEN
      DELETE FROM public.calendar_event_notes
      WHERE user_id = user_id_param;
    END IF;
  END IF;

  -- Note: We do NOT delete:
  -- - auth.users (preserved)
  -- - profiles (preserved)
  -- - subscriptions (preserved, updated below)
  -- - agents (preserved - these are definitions/configs)
  -- - has_used_trial flags (preserved in profiles)
  -- - gmail_connections (preserved - connection configs, not interaction data)
  -- - calendar_connections (preserved - connection configs, not interaction data)

  -- Update subscription to reflect data has been cleared
  UPDATE public.subscriptions
  SET 
    tier = 'data_cleared',
    status = 'inactive',
    updated_at = NOW()
  WHERE 
    user_id = user_id_param
    AND data_retention_expires_at IS NOT NULL
    AND NOW() > data_retention_expires_at;

  -- Also update profile for backward compatibility
  UPDATE public.profiles
  SET 
    subscription_tier = 'data_cleared',
    subscription_status = 'inactive',
    updated_at = NOW()
  WHERE 
    id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. FUNCTION TO RUN DAILY CLEANUP JOB
-- ============================================================================

-- Main cleanup function to be called by scheduled job
-- Finds all users past retention period and clears their interaction data
CREATE OR REPLACE FUNCTION public.run_data_retention_cleanup()
RETURNS TABLE(
  user_id UUID,
  cleared_at TIMESTAMPTZ,
  retention_reason TEXT
) AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Find all users where:
  -- 1. data_retention_expires_at is set
  -- 2. Current time is past the expiration
  -- 3. User does NOT have an active paid subscription
  FOR user_record IN
    SELECT 
      s.user_id,
      s.data_retention_reason
    FROM public.subscriptions s
    WHERE 
      s.data_retention_expires_at IS NOT NULL
      AND NOW() > s.data_retention_expires_at
      AND s.tier NOT IN ('basic', 'advanced', 'elite')
      AND s.status NOT IN ('active', 'trialing')
      AND (s.stripe_subscription_id IS NULL OR s.stripe_subscription_id = '')
  LOOP
    -- Clear interaction data for this user
    PERFORM public.clear_user_interaction_data(user_record.user_id);
    
    -- Return record of what was cleared
    user_id := user_record.user_id;
    cleared_at := NOW();
    retention_reason := user_record.data_retention_reason;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. UPDATE SYNC TRIGGER TO INCLUDE RETENTION FIELDS
-- ============================================================================

-- Update the sync function to include retention fields
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
    trial_ended_at = NEW.trial_ended_at,
    data_retention_expires_at = NEW.data_retention_expires_at,
    data_retention_reason = NEW.data_retention_reason,
    paid_canceled_at = NEW.paid_canceled_at,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. FUNCTION TO CLEAR RETENTION WHEN USER REACTIVATES
-- ============================================================================

-- Function to clear retention window when user upgrades/reactivates
-- This preserves all data since user is reactivating within retention period
CREATE OR REPLACE FUNCTION public.clear_retention_on_reactivation(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.subscriptions
  SET 
    data_retention_expires_at = NULL,
    data_retention_reason = NULL,
    -- Keep trial_ended_at and paid_canceled_at for history
    updated_at = NOW()
  WHERE 
    user_id = user_id_param
    AND tier IN ('basic', 'advanced', 'elite')
    AND status IN ('active', 'trialing');
    
  -- Also update profile
  UPDATE public.profiles
  SET 
    data_retention_expires_at = NULL,
    data_retention_reason = NULL,
    updated_at = NOW()
  WHERE 
    id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



-- ============================================================================
-- Migration: 20241130000001_call_campaigns_and_knowledge_gaps.sql
-- ============================================================================
-- Call Campaigns and Knowledge Gaps System
-- This migration creates tables for Aloha call campaigns and agent knowledge gap tracking

-- Call Campaigns table
-- Stores campaign definitions with time window rules
CREATE TABLE IF NOT EXISTS call_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic campaign info
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('cold_call', 'feedback', 'appointment_reminder')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'canceled')),
  
  -- Time window rules (CRITICAL for compliance)
  timezone TEXT NOT NULL DEFAULT 'America/New_York', -- IANA timezone string
  allowed_call_start_time TIME NOT NULL DEFAULT '09:00:00', -- Time without timezone
  allowed_call_end_time TIME NOT NULL DEFAULT '18:00:00', -- Time without timezone
  allowed_days_of_week JSONB NOT NULL DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb, -- Array of day abbreviations
  
  -- Campaign configuration
  script_template TEXT, -- Optional script or talking points
  rate_limit_per_minute INTEGER DEFAULT 5, -- Max calls per minute
  rate_limit_per_hour INTEGER DEFAULT 30, -- Max calls per hour
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE, -- When campaign was started
  completed_at TIMESTAMP WITH TIME ZONE, -- When campaign was completed
  paused_at TIMESTAMP WITH TIME ZONE -- When campaign was paused
);

-- Call Campaign Targets table
-- Stores individual phone numbers to call in a campaign
CREATE TABLE IF NOT EXISTS call_campaign_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES call_campaigns(id) ON DELETE CASCADE,
  
  -- Contact information
  phone_number TEXT NOT NULL,
  contact_name TEXT, -- Optional name
  contact_metadata JSONB DEFAULT '{}'::jsonb, -- Additional contact info
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'calling', 'completed', 'failed', 'skipped')),
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3, -- Max retry attempts
  
  -- Call outcome
  last_call_log_id UUID, -- FK to call logs (if exists)
  call_outcome TEXT, -- 'answered', 'voicemail', 'no_answer', 'busy', 'failed'
  call_summary TEXT, -- Summary of the call
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent Knowledge Gaps table
-- Tracks when agents encounter missing information
CREATE TABLE IF NOT EXISTS agent_knowledge_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Agent and source info
  agent TEXT NOT NULL CHECK (agent IN ('aloha', 'sync', 'studio', 'insight')),
  source TEXT NOT NULL CHECK (source IN ('call', 'email', 'chat', 'other')),
  context_id TEXT, -- FK to call_log / conversation / email thread (flexible, can be UUID or string)
  
  -- Gap information
  question TEXT NOT NULL, -- The question that couldn't be answered
  requested_info TEXT NOT NULL, -- What information was requested
  suggested_category TEXT CHECK (suggested_category IN ('pricing', 'services', 'hours', 'policy', 'booking', 'location', 'contact', 'other')),
  
  -- Resolution tracking
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by_user_id UUID REFERENCES auth.users(id), -- Who resolved it
  resolution_notes TEXT, -- How it was resolved
  resolution_action TEXT, -- What was done (e.g., 'updated_business_info', 'added_knowledge_chunk')
  
  -- Additional context
  context_metadata JSONB DEFAULT '{}'::jsonb, -- Additional context about when/where gap occurred
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_campaigns_user_id ON call_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_call_campaigns_status ON call_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_call_campaigns_type ON call_campaigns(type);
CREATE INDEX IF NOT EXISTS idx_call_campaign_targets_campaign_id ON call_campaign_targets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_call_campaign_targets_status ON call_campaign_targets(status);
CREATE INDEX IF NOT EXISTS idx_call_campaign_targets_phone ON call_campaign_targets(phone_number);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_gaps_user_id ON agent_knowledge_gaps(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_gaps_status ON agent_knowledge_gaps(status);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_gaps_agent ON agent_knowledge_gaps(agent);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_gaps_category ON agent_knowledge_gaps(suggested_category);

-- GIN indexes for JSONB
CREATE INDEX IF NOT EXISTS idx_call_campaigns_allowed_days ON public.call_campaigns USING GIN(allowed_days_of_week);
CREATE INDEX IF NOT EXISTS idx_call_campaign_targets_metadata ON public.call_campaign_targets USING GIN(contact_metadata);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_gaps_metadata ON public.agent_knowledge_gaps USING GIN(context_metadata);

-- Functions to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_call_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_call_campaign_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_agent_knowledge_gaps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_call_campaigns_updated_at ON call_campaigns;
CREATE TRIGGER trigger_update_call_campaigns_updated_at
  BEFORE UPDATE ON public.call_campaigns FOR EACH ROW
  EXECUTE FUNCTION update_call_campaigns_updated_at();

DROP TRIGGER IF EXISTS trigger_update_call_campaign_targets_updated_at ON call_campaign_targets;
CREATE TRIGGER trigger_update_call_campaign_targets_updated_at
  BEFORE UPDATE ON public.call_campaign_targets FOR EACH ROW
  EXECUTE FUNCTION update_call_campaign_targets_updated_at();

DROP TRIGGER IF EXISTS trigger_update_agent_knowledge_gaps_updated_at ON agent_knowledge_gaps;
CREATE TRIGGER trigger_update_agent_knowledge_gaps_updated_at
  BEFORE UPDATE ON public.agent_knowledge_gaps FOR EACH ROW
  EXECUTE FUNCTION update_agent_knowledge_gaps_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE call_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_campaign_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_gaps ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own campaigns
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view their own call campaigns" ON public.call_campaigns CASCADE;
CREATE POLICY "Users can view their own call campaigns"
  ON public.call_campaigns FOR SELECT
  USING (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert their own call campaigns" ON public.call_campaigns CASCADE;
CREATE POLICY "Users can insert their own call campaigns"
  ON public.call_campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update their own call campaigns" ON public.call_campaigns CASCADE;
CREATE POLICY "Users can update their own call campaigns"
  ON public.call_campaigns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete their own call campaigns" ON public.call_campaigns CASCADE;
CREATE POLICY "Users can delete their own call campaigns"
  ON public.call_campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for campaign targets
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view targets for their campaigns" ON public.call_campaign_targets CASCADE;
CREATE POLICY "Users can view targets for their campaigns"
  ON public.call_campaign_targets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM call_campaigns
      WHERE call_campaigns.id = call_campaign_targets.campaign_id
      AND call_campaigns.user_id = auth.uid()
    )
  );

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert targets for their campaigns" ON public.call_campaign_targets CASCADE;
CREATE POLICY "Users can insert targets for their campaigns"
  ON public.call_campaign_targets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM call_campaigns
      WHERE call_campaigns.id = call_campaign_targets.campaign_id
      AND call_campaigns.user_id = auth.uid()
    )
  );

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update targets for their campaigns" ON public.call_campaign_targets CASCADE;
CREATE POLICY "Users can update targets for their campaigns"
  ON public.call_campaign_targets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM call_campaigns
      WHERE call_campaigns.id = call_campaign_targets.campaign_id
      AND call_campaigns.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM call_campaigns
      WHERE call_campaigns.id = call_campaign_targets.campaign_id
      AND call_campaigns.user_id = auth.uid()
    )
  );

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete targets for their campaigns" ON public.call_campaign_targets CASCADE;
CREATE POLICY "Users can delete targets for their campaigns"
  ON public.call_campaign_targets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM call_campaigns
      WHERE call_campaigns.id = call_campaign_targets.campaign_id
      AND call_campaigns.user_id = auth.uid()
    )
  );

-- RLS Policies for knowledge gaps
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view their own knowledge gaps" ON public.agent_knowledge_gaps CASCADE;
CREATE POLICY "Users can view their own knowledge gaps"
  ON public.agent_knowledge_gaps FOR SELECT
  USING (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert their own knowledge gaps" ON public.agent_knowledge_gaps CASCADE;
CREATE POLICY "Users can insert their own knowledge gaps"
  ON public.agent_knowledge_gaps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update their own knowledge gaps" ON public.agent_knowledge_gaps CASCADE;
CREATE POLICY "Users can update their own knowledge gaps"
  ON public.agent_knowledge_gaps FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete their own knowledge gaps" ON public.agent_knowledge_gaps CASCADE;
CREATE POLICY "Users can delete their own knowledge gaps"
  ON public.agent_knowledge_gaps FOR DELETE
  USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE call_campaigns IS 'Call campaigns for Aloha agent. Campaigns only run when explicitly started by user and respect time window rules.';
COMMENT ON TABLE call_campaign_targets IS 'Individual phone numbers to call in a campaign. Tracks call attempts and outcomes.';
COMMENT ON TABLE agent_knowledge_gaps IS 'Tracks when agents encounter missing information. Agents log gaps instead of inventing information.';
COMMENT ON COLUMN call_campaigns.allowed_days_of_week IS 'Array of day abbreviations: ["mon","tue","wed","thu","fri","sat","sun"]';
COMMENT ON COLUMN call_campaigns.timezone IS 'IANA timezone string (e.g., "America/New_York") for time window calculations';
COMMENT ON COLUMN agent_knowledge_gaps.context_id IS 'Flexible reference to source (call_log id, email thread id, conversation id, etc.)';













-- ============================================================================
-- Migration: 20241204000000_add_voice_key_to_aloha_profiles.sql
-- ============================================================================
-- Add voice_key column to aloha_profiles table
-- This stores which of the 4 voice profiles the user has selected

ALTER TABLE aloha_profiles
ADD COLUMN IF NOT EXISTS voice_key TEXT;

-- Set default voice_key for existing profiles
UPDATE aloha_profiles
SET voice_key = 'aloha_voice_friendly_female_us'
WHERE voice_key IS NULL;

-- Set default for new profiles
ALTER TABLE aloha_profiles
ALTER COLUMN voice_key SET DEFAULT 'aloha_voice_friendly_female_us';

-- Add comment
COMMENT ON COLUMN aloha_profiles.voice_key IS 'Selected voice profile key (one of 4 predefined Aloha voice profiles)';













-- ============================================================================
-- Migration: 20241204000000_contact_profiles.sql
-- ============================================================================
-- Contact Profiles and Call Memory
-- Adds lightweight contact memory per phone number for Aloha

-- Create contact_profiles table
CREATE TABLE IF NOT EXISTS contact_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  notes TEXT,
  do_not_call BOOLEAN DEFAULT false,
  preferred_call_window JSONB, -- Optional: can mirror campaign time window shape
  last_called_at TIMESTAMPTZ,
  last_campaign_id UUID REFERENCES call_campaigns(id) ON DELETE SET NULL,
  last_outcome TEXT, -- e.g. 'feedback_collected', 'rescheduled', 'not_interested', 'asked_for_email', 'do_not_call', 'no_answer'
  times_contacted INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique phone number per user
  CONSTRAINT contact_profiles_user_phone_unique UNIQUE (user_id, phone_number)
);

-- Create indexes for contact_profiles
CREATE INDEX IF NOT EXISTS idx_contact_profiles_user_id ON contact_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_phone_number ON contact_profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_do_not_call ON contact_profiles(do_not_call);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_last_called_at ON contact_profiles(last_called_at);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_user_phone ON contact_profiles(user_id, phone_number);

-- Comments
COMMENT ON TABLE contact_profiles IS 'Lightweight contact memory per phone number for Aloha. Stores basic info about callers and past calls.';
COMMENT ON COLUMN contact_profiles.phone_number IS 'Normalized phone number (E.164 format recommended)';
COMMENT ON COLUMN contact_profiles.name IS 'Caller preferred name, if learned';
COMMENT ON COLUMN contact_profiles.notes IS 'Short internal notes like "prefers evenings" or "likes short calls". Keep non-sensitive.';
COMMENT ON COLUMN contact_profiles.do_not_call IS 'If true, do not call this contact for outbound campaigns';
COMMENT ON COLUMN contact_profiles.preferred_call_window IS 'Optional preferred call time window (future use)';
COMMENT ON COLUMN contact_profiles.last_outcome IS 'Last call outcome: feedback_collected, rescheduled, not_interested, asked_for_email, do_not_call, no_answer, etc.';

-- Update calls table to link to contact_profiles
DO $$
BEGIN
  -- Add contact_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'contact_id'
  ) THEN
    ALTER TABLE calls ADD COLUMN contact_id UUID REFERENCES contact_profiles(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id);
    COMMENT ON COLUMN calls.contact_id IS 'Link to contact_profiles if caller is known';
  END IF;

  -- Add sentiment column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'sentiment'
  ) THEN
    ALTER TABLE calls ADD COLUMN sentiment TEXT;
    CREATE INDEX IF NOT EXISTS idx_calls_sentiment ON calls(sentiment);
    COMMENT ON COLUMN calls.sentiment IS 'Call sentiment: angry, neutral, happy, upset, frustrated, confused, stressed';
  END IF;

  -- Add direction column if it doesn't exist (inbound vs outbound)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'direction'
  ) THEN
    ALTER TABLE calls ADD COLUMN direction TEXT CHECK (direction IN ('inbound', 'outbound'));
    CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);
    COMMENT ON COLUMN calls.direction IS 'Call direction: inbound or outbound';
  END IF;

  -- Add campaign_id column if it doesn't exist (for outbound campaigns)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE calls ADD COLUMN campaign_id UUID REFERENCES call_campaigns(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_calls_campaign_id ON calls(campaign_id);
    COMMENT ON COLUMN calls.campaign_id IS 'Link to call_campaigns if this is a campaign call';
  END IF;

  -- Add phone_number column if it doesn't exist (for quick lookup)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE calls ADD COLUMN phone_number TEXT;
    CREATE INDEX IF NOT EXISTS idx_calls_phone_number ON calls(phone_number);
    COMMENT ON COLUMN calls.phone_number IS 'Normalized phone number for this call';
  END IF;
END $$;

-- Create updated_at trigger for contact_profiles
CREATE OR REPLACE FUNCTION update_contact_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_contact_profiles_updated_at ON contact_profiles;
CREATE TRIGGER trigger_update_contact_profiles_updated_at
  BEFORE UPDATE ON public.contact_profiles FOR EACH ROW
  EXECUTE FUNCTION update_contact_profiles_updated_at();

-- Enable RLS on contact_profiles
ALTER TABLE contact_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contact_profiles
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view their own contact profiles" ON public.contact_profiles CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view their own contact profiles" ON public.contact_profiles CASCADE;
CREATE POLICY "Users can view their own contact profiles"
  ON public.contact_profiles FOR SELECT
  USING (user_id = auth.uid());

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert their own contact profiles" ON public.contact_profiles CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert their own contact profiles" ON public.contact_profiles CASCADE;
CREATE POLICY "Users can insert their own contact profiles"
  ON public.contact_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update their own contact profiles" ON public.contact_profiles CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update their own contact profiles" ON public.contact_profiles CASCADE;
CREATE POLICY "Users can update their own contact profiles"
  ON public.contact_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete their own contact profiles" ON public.contact_profiles CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete their own contact profiles" ON public.contact_profiles CASCADE;
CREATE POLICY "Users can delete their own contact profiles"
  ON public.contact_profiles FOR DELETE
  USING (user_id = auth.uid());

-- Helper function to normalize phone number (basic E.164 normalization)
CREATE OR REPLACE FUNCTION normalize_phone_number(phone TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove all non-digit characters except +
  phone := regexp_replace(phone, '[^0-9+]', '', 'g');
  
  -- If doesn't start with +, assume US number and add +1
  IF NOT phone LIKE '+%' THEN
    -- If starts with 1 and has 11 digits total, add +
    IF length(phone) = 11 AND phone LIKE '1%' THEN
      phone := '+' || phone;
    -- If has 10 digits, assume US and add +1
    ELSIF length(phone) = 10 THEN
      phone := '+1' || phone;
    END IF;
  END IF;
  
  RETURN phone;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION normalize_phone_number IS 'Normalizes phone number to E.164 format (basic implementation)';



-- ============================================================================
-- Migration: 20241205000000_aloha_voicemail.sql
-- ============================================================================
-- Aloha Voicemail Feature
-- Adds voicemail mode support for external phone numbers

-- Create user_phone_numbers table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL, -- Twilio number (E.164 format)
  external_phone_number TEXT, -- User's real SIM/carrier number (nullable)
  voicemail_enabled BOOLEAN NOT NULL DEFAULT false,
  voicemail_mode TEXT NOT NULL DEFAULT 'none' CHECK (voicemail_mode IN ('none', 'voicemail_only', 'receptionist')),
  forwarding_enabled BOOLEAN NOT NULL DEFAULT false,
  forwarding_confirmed BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  twilio_phone_sid TEXT, -- Twilio Phone Number SID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_phone_number ON user_phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_user_id ON user_phone_numbers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_active ON user_phone_numbers(user_id, is_active) WHERE is_active = true;

-- Add comments
COMMENT ON TABLE user_phone_numbers IS 'Stores Twilio phone numbers assigned to users. Supports voicemail mode for external phone forwarding.';
COMMENT ON COLUMN user_phone_numbers.phone_number IS 'Twilio number in E.164 format (e.g., +15551234567)';
COMMENT ON COLUMN user_phone_numbers.external_phone_number IS 'User''s real SIM/carrier number that forwards to the Twilio number';
COMMENT ON COLUMN user_phone_numbers.voicemail_enabled IS 'Whether voicemail mode is enabled for this number';
COMMENT ON COLUMN user_phone_numbers.voicemail_mode IS 'Voicemail mode: none, voicemail_only, or receptionist';
COMMENT ON COLUMN user_phone_numbers.forwarding_enabled IS 'Whether user has enabled call forwarding';
COMMENT ON COLUMN user_phone_numbers.forwarding_confirmed IS 'Whether user has confirmed they set up forwarding';
COMMENT ON COLUMN user_phone_numbers.is_active IS 'Whether this is the active number for the user (only one active per user)';

-- Function to automatically disable voicemail when number is released
CREATE OR REPLACE FUNCTION disable_voicemail_on_number_release()
RETURNS TRIGGER AS $$
BEGIN
  -- When a number is deactivated, disable voicemail and forwarding
  IF OLD.is_active = true AND NEW.is_active = false THEN
    NEW.voicemail_enabled = false;
    NEW.forwarding_enabled = false;
    NEW.forwarding_confirmed = false;
    NEW.external_phone_number = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to disable voicemail when number is released
CREATE TRIGGER trigger_disable_voicemail_on_release
  BEFORE UPDATE ON public.user_phone_numbers FOR EACH ROW
  WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
  EXECUTE FUNCTION disable_voicemail_on_number_release();

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION update_user_phone_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_phone_numbers_updated_at
  BEFORE UPDATE ON public.user_phone_numbers FOR EACH ROW
  EXECUTE FUNCTION update_user_phone_numbers_updated_at();

-- RLS policies
ALTER TABLE user_phone_numbers ENABLE ROW LEVEL SECURITY;

-- Users can only see their own phone numbers
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view their own phone numbers" ON public.user_phone_numbers CASCADE;
CREATE POLICY "Users can view their own phone numbers"
  ON public.user_phone_numbers FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own phone numbers
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert their own phone numbers" ON public.user_phone_numbers CASCADE;
CREATE POLICY "Users can insert their own phone numbers"
  ON public.user_phone_numbers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own phone numbers
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update their own phone numbers" ON public.user_phone_numbers CASCADE;
CREATE POLICY "Users can update their own phone numbers"
  ON public.user_phone_numbers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own phone numbers
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete their own phone numbers" ON public.user_phone_numbers CASCADE;
CREATE POLICY "Users can delete their own phone numbers"
  ON public.user_phone_numbers FOR DELETE
  USING (auth.uid() = user_id);













-- ============================================================================
-- Migration: 20241205000000_user_phone_numbers.sql
-- ============================================================================
-- User Phone Numbers and Twilio Integration
-- Supports one active Twilio number per user, voicemail, and call forwarding

-- Create user_phone_numbers table
CREATE TABLE IF NOT EXISTS user_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  twilio_phone_sid TEXT NOT NULL, -- Twilio IncomingPhoneNumber SID (or "SIMULATED_SID_*" in mock mode)
  phone_number TEXT NOT NULL, -- Twilio number in E.164 format
  country TEXT NOT NULL DEFAULT 'US',
  area_code TEXT, -- Nullable area code
  is_active BOOLEAN DEFAULT true, -- Only ONE active per user
  voicemail_enabled BOOLEAN DEFAULT false,
  voicemail_mode TEXT DEFAULT 'none' CHECK (voicemail_mode IN ('none', 'voicemail_only', 'receptionist')),
  external_phone_number TEXT, -- User's real SIM/carrier number
  forwarding_enabled BOOLEAN DEFAULT false,
  forwarding_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: One active number per user is enforced at the application level
-- When setting a new number to active, the application will deactivate existing active numbers

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_user_id ON user_phone_numbers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_phone_number ON user_phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_is_active ON user_phone_numbers(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_twilio_sid ON user_phone_numbers(twilio_phone_sid);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_phone_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_phone_numbers_updated_at ON user_phone_numbers;
CREATE TRIGGER trigger_update_user_phone_numbers_updated_at
  BEFORE UPDATE ON public.user_phone_numbers FOR EACH ROW
  EXECUTE FUNCTION update_user_phone_numbers_updated_at();

-- Enable RLS
ALTER TABLE user_phone_numbers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view their own phone numbers" ON public.user_phone_numbers CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view their own phone numbers" ON public.user_phone_numbers CASCADE;
CREATE POLICY "Users can view their own phone numbers"
  ON public.user_phone_numbers FOR SELECT
  USING (user_id = auth.uid());

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert their own phone numbers" ON public.user_phone_numbers CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert their own phone numbers" ON public.user_phone_numbers CASCADE;
CREATE POLICY "Users can insert their own phone numbers"
  ON public.user_phone_numbers FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update their own phone numbers" ON public.user_phone_numbers CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update their own phone numbers" ON public.user_phone_numbers CASCADE;
CREATE POLICY "Users can update their own phone numbers"
  ON public.user_phone_numbers FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete their own phone numbers" ON public.user_phone_numbers CASCADE;
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete their own phone numbers" ON public.user_phone_numbers CASCADE;
CREATE POLICY "Users can delete their own phone numbers"
  ON public.user_phone_numbers FOR DELETE
  USING (user_id = auth.uid());

-- Comments
COMMENT ON TABLE user_phone_numbers IS 'Stores Twilio phone numbers assigned to users. Only one active number per user.';
COMMENT ON COLUMN user_phone_numbers.twilio_phone_sid IS 'Twilio IncomingPhoneNumber SID, or "SIMULATED_SID_*" in mock mode';
COMMENT ON COLUMN user_phone_numbers.phone_number IS 'Phone number in E.164 format (e.g., +14155551234)';
COMMENT ON COLUMN user_phone_numbers.is_active IS 'Only one active number per user. When setting a new number to active, deactivate others.';
COMMENT ON COLUMN user_phone_numbers.voicemail_enabled IS 'Whether Aloha should act as voicemail for this number';
COMMENT ON COLUMN user_phone_numbers.voicemail_mode IS 'Voicemail mode: none, voicemail_only, or receptionist';
COMMENT ON COLUMN user_phone_numbers.external_phone_number IS 'User''s real SIM/carrier phone number for call forwarding';
COMMENT ON COLUMN user_phone_numbers.forwarding_enabled IS 'User has chosen to use carrier call forwarding to this Twilio number';
COMMENT ON COLUMN user_phone_numbers.forwarding_confirmed IS 'User clicked "I''ve set up forwarding" in the UI';



-- ============================================================================
-- Migration: 20241206000000_add_stripe_webhook_events.sql
-- ============================================================================
-- Track processed Stripe webhook events for idempotency
create table if not exists public.stripe_webhook_events (
  id text primary key,
  created_at timestamptz default now()
);














-- ============================================================================
-- Migration: 20241207000000_user_openai_keys.sql
-- ============================================================================
-- Per-user OpenAI API keys
-- This table lets different users bring their own OpenAI keys.

create table if not exists public.user_openai_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'openai' check (provider = 'openai'),
  api_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists user_openai_keys_user_id_idx
  on public.user_openai_keys (user_id)
  where is_active = true;

create or replace function public.update_user_openai_keys_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_user_openai_keys_updated_at
  on public.user_openai_keys;

create trigger trigger_update_user_openai_keys_updated_at
  before update on public.user_openai_keys
  for each row
  execute function public.update_user_openai_keys_updated_at();

-- Enable row level security
alter table public.user_openai_keys enable row level security;

-- Users can manage only their own keys
create policy "Users can view their own OpenAI keys"
  on public.user_openai_keys
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own OpenAI keys"
  on public.user_openai_keys
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own OpenAI keys"
  on public.user_openai_keys
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own OpenAI keys"
  on public.user_openai_keys
  for delete
  using (auth.uid() = user_id);













-- ============================================================================
-- Migration: 20241208000000_ensure_trial_columns.sql
-- ============================================================================
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





-- ============================================================================
-- Migration: 20241209000000_add_aloha_self_name.sql
-- ============================================================================
-- Add aloha_self_name column to aloha_profiles table
-- This stores the custom name the agent should call itself (defaults to "Aloha" if empty)

ALTER TABLE aloha_profiles
ADD COLUMN IF NOT EXISTS aloha_self_name TEXT;

-- Add comment
COMMENT ON COLUMN aloha_profiles.aloha_self_name IS 'Custom name the agent calls itself. If empty or null, defaults to "Aloha".';





-- ============================================================================
-- Migration: 20241210000000_insights_and_workflows.sql
-- ============================================================================
-- Insights and Workflows System
-- This migration creates tables for Insight Agent insights and workflows

-- Insights table
-- Stores insights generated by agents or the Insight Agent itself
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Source and categorization
  source TEXT NOT NULL CHECK (source IN ('aloha', 'sync', 'studio', 'insight_agent', 'system', 'manual')),
  category TEXT NOT NULL CHECK (category IN ('productivity', 'communication', 'finance', 'sales', 'risk', 'ops', 'misc')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  
  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Time range (for rollup insights)
  time_range TEXT, -- e.g., 'this week', 'today', 'last month'
  
  -- Tags and metadata
  tags JSONB DEFAULT '[]'::jsonb, -- Array of strings
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Actions (recommended actions with type + payload)
  actions JSONB DEFAULT '[]'::jsonb, -- Array of action objects
  
  -- Read/dismiss tracking
  is_read BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflows table (fix missing table)
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  
  -- Trigger configuration
  trigger TEXT NOT NULL CHECK (trigger IN ('email.received', 'calendar.event.created', 'metric.updated', 'time-based', 'user-initiated', 'insight.generated')),
  trigger_config JSONB DEFAULT '{}'::jsonb, -- Additional trigger configuration
  
  -- Condition (optional)
  condition JSONB, -- { field, operator, value }
  
  -- Actions
  actions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of action strings
  
  -- Execution tracking
  last_run_at TIMESTAMP WITH TIME ZONE,
  run_count INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insight Briefs table (store generated briefs)
CREATE TABLE IF NOT EXISTS insight_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Brief configuration
  range TEXT NOT NULL CHECK (range IN ('daily', 'weekly', 'monthly')),
  
  -- Brief content (structured JSON)
  brief_data JSONB NOT NULL, -- Stores the full brief structure
  
  -- Timestamps
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_insights_user_id ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_created_at ON insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_source ON insights(source);
CREATE INDEX IF NOT EXISTS idx_insights_category ON insights(category);
CREATE INDEX IF NOT EXISTS idx_insights_severity ON insights(severity);
CREATE INDEX IF NOT EXISTS idx_insights_is_read ON insights(is_read);
CREATE INDEX IF NOT EXISTS idx_insights_user_created ON insights(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON workflows(enabled);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(trigger);

CREATE INDEX IF NOT EXISTS idx_insight_briefs_user_id ON insight_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_insight_briefs_range ON insight_briefs(range);
CREATE INDEX IF NOT EXISTS idx_insight_briefs_generated_at ON insight_briefs(generated_at DESC);

-- RLS Policies
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_briefs ENABLE ROW LEVEL SECURITY;

-- Insights policies
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view their own insights" ON public.insights CASCADE;
CREATE POLICY "Users can view their own insights"
  ON public.insights FOR SELECT
  USING (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert their own insights" ON public.insights CASCADE;
CREATE POLICY "Users can insert their own insights"
  ON public.insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update their own insights" ON public.insights CASCADE;
CREATE POLICY "Users can update their own insights"
  ON public.insights FOR UPDATE
  USING (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete their own insights" ON public.insights CASCADE;
CREATE POLICY "Users can delete their own insights"
  ON public.insights FOR DELETE
  USING (auth.uid() = user_id);

-- Workflows policies
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view their own workflows" ON public.workflows CASCADE;
CREATE POLICY "Users can view their own workflows"
  ON public.workflows FOR SELECT
  USING (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert their own workflows" ON public.workflows CASCADE;
CREATE POLICY "Users can insert their own workflows"
  ON public.workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update their own workflows" ON public.workflows CASCADE;
CREATE POLICY "Users can update their own workflows"
  ON public.workflows FOR UPDATE
  USING (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete their own workflows" ON public.workflows CASCADE;
CREATE POLICY "Users can delete their own workflows"
  ON public.workflows FOR DELETE
  USING (auth.uid() = user_id);

-- Insight Briefs policies
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view their own briefs" ON public.insight_briefs CASCADE;
CREATE POLICY "Users can view their own briefs"
  ON public.insight_briefs FOR SELECT
  USING (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert their own briefs" ON public.insight_briefs CASCADE;
CREATE POLICY "Users can insert their own briefs"
  ON public.insight_briefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete their own briefs" ON public.insight_briefs CASCADE;
CREATE POLICY "Users can delete their own briefs"
  ON public.insight_briefs FOR DELETE
  USING (auth.uid() = user_id);



-- ============================================================================
-- Migration: 20241211000000_workspace_team_management.sql
-- ============================================================================
-- Workspace and Team Management System
-- This migration creates tables for multi-user team management with seat-based pricing

-- Workspaces table
-- Each user can own/be part of a workspace (for now, each user gets their own workspace)
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(owner_user_id)
);

-- Workspace seats table
-- Tracks who has access to a workspace and at what tier
CREATE TABLE IF NOT EXISTS workspace_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT, -- For pending invites where user doesn't exist yet
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'advanced', 'elite')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'removed')),
  is_owner BOOLEAN DEFAULT FALSE, -- Track workspace owner
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id) -- One seat per user per workspace
);

-- Workspace invites table
-- Tracks pending invitations with invite codes
CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  seat_id UUID REFERENCES workspace_seats(id) ON DELETE CASCADE,
  email TEXT, -- Optional: if provided, invite is email-specific
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'advanced', 'elite')),
  invite_code TEXT NOT NULL UNIQUE, -- Short unique code for invite links
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_user_id ON workspaces(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_seats_workspace_id ON workspace_seats(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_seats_user_id ON workspace_seats(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_seats_status ON workspace_seats(status);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_id ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_invite_code ON workspace_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(email);

-- RLS Policies
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

-- Workspaces policies
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view their own workspace" ON public.workspaces CASCADE;
CREATE POLICY "Users can view their own workspace"
  ON public.workspaces FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert their own workspace" ON public.workspaces CASCADE;
CREATE POLICY "Users can insert their own workspace"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update their own workspace" ON public.workspaces CASCADE;
CREATE POLICY "Users can update their own workspace"
  ON public.workspaces FOR UPDATE
  USING (auth.uid() = owner_user_id);

-- Workspace seats policies
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view seats in their workspace" ON public.workspace_seats CASCADE;
CREATE POLICY "Users can view seats in their workspace"
  ON public.workspace_seats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_seats.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Drop policy if exists
DROP POLICY IF EXISTS "Workspace owners can manage seats" ON public.workspace_seats CASCADE;
CREATE POLICY "Workspace owners can manage seats"
  ON public.workspace_seats FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_seats.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
  );

-- Workspace invites policies
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view invites for their workspace" ON public.workspace_invites CASCADE;
CREATE POLICY "Users can view invites for their workspace"
  ON public.workspace_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_invites.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Drop policy if exists
DROP POLICY IF EXISTS "Workspace owners can manage invites" ON public.workspace_invites CASCADE;
CREATE POLICY "Workspace owners can manage invites"
  ON public.workspace_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_invites.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
  );

-- Function to auto-create workspace for new users
CREATE OR REPLACE FUNCTION create_workspace_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspaces (owner_user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'My Workspace'))
  ON CONFLICT (owner_user_id) DO NOTHING;
  
  -- Create owner seat
  INSERT INTO workspace_seats (workspace_id, user_id, tier, status, is_owner)
  SELECT id, NEW.id, 'basic', 'active', TRUE
  FROM workspaces
  WHERE owner_user_id = NEW.id
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create workspace when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_workspace_for_user();



-- ============================================================================
-- Migration: 20241211000001_add_stripe_to_workspaces.sql
-- ============================================================================
-- Add Stripe billing fields to workspaces table
-- This migration adds Stripe customer and subscription IDs to workspaces for team billing

ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Index for Stripe customer lookup
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_customer_id ON workspaces(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_subscription_id ON workspaces(stripe_subscription_id);

-- Add comment
COMMENT ON COLUMN workspaces.stripe_customer_id IS 'Stripe customer ID for workspace billing';
COMMENT ON COLUMN workspaces.stripe_subscription_id IS 'Stripe subscription ID for workspace team seats';



-- ============================================================================
-- Migration: 20241212000000_insight_memory_and_personalization.sql
-- ============================================================================
-- 20241212000000_insight_memory_and_personalization.sql

-- 1. Insight memory facts
create table if not exists public.insight_memory_facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null check (type in (
    'preference',
    'pattern',
    'behavior',
    'risk',
    'tag',
    'goal'
  )),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  confidence real not null default 0.5,        -- 0..1
  importance_score integer not null default 50, -- 0..100
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists insight_memory_facts_workspace_type_key_idx
  on public.insight_memory_facts (workspace_id, type, key);

create index if not exists insight_memory_facts_workspace_idx
  on public.insight_memory_facts (workspace_id);

-- 2. User goals tracked by Insight
create table if not exists public.insight_user_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  goal_label text not null,
  description text,
  priority smallint not null default 3 check (priority between 1 and 5),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insight_user_goals_workspace_idx
  on public.insight_user_goals (workspace_id);

-- 3. Important relationships (contacts, companies, projects, etc.)
create table if not exists public.insight_relationships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('contact', 'company', 'project')),
  entity_identifier text not null,  -- e.g. email, domain, project slug
  display_name text,
  interaction_count integer not null default 0,
  sentiment_score real,            -- -1..1 if you track this
  last_contact_at timestamptz,
  importance_score integer not null default 50, -- 0..100
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insight_relationships_workspace_entity_unique
    unique (workspace_id, entity_type, entity_identifier)
);

create index if not exists insight_relationships_workspace_idx
  on public.insight_relationships (workspace_id);

-- 4. RLS

alter table public.insight_memory_facts enable row level security;
alter table public.insight_user_goals enable row level security;
alter table public.insight_relationships enable row level security;

-- NOTE: adjust column names if workspaces / workspace_seats differ.
-- Assumes:
--   workspaces(id, owner_user_id)
--   workspace_seats(workspace_id, user_id, status)

create policy "workspace_members_can_select_insight_memory"
on public.insight_memory_facts
for select
using (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_memory_facts.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
);

create policy "workspace_members_can_modify_insight_memory"
on public.insight_memory_facts
for all
using (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_memory_facts.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_memory_facts.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
);

create policy "workspace_members_can_select_goals"
on public.insight_user_goals
for select
using (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_user_goals.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
);

create policy "workspace_members_can_modify_goals"
on public.insight_user_goals
for all
using (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_user_goals.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_user_goals.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
);

create policy "workspace_members_can_select_relationships"
on public.insight_relationships
for select
using (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_relationships.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
);

create policy "workspace_members_can_modify_relationships"
on public.insight_relationships
for all
using (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_relationships.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_relationships.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
);



-- ============================================================================
-- Migration: 20241213000000_email_queue.sql
-- ============================================================================
-- Migration: Create email_queue table
-- This table stores emails synced from Gmail and manages OVRSEE queue state

CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Gmail mapping fields
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  gmail_history_id TEXT, -- For incremental sync
  gmail_labels TEXT[], -- Array of Gmail labels (INBOX, STARRED, etc.)
  
  -- Email content
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses TEXT[],
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  subject TEXT NOT NULL,
  snippet TEXT,
  body_html TEXT,
  body_text TEXT,
  internal_date TIMESTAMPTZ NOT NULL, -- Raw Gmail timestamp
  
  -- OVRSEE queue state
  queue_status TEXT NOT NULL DEFAULT 'open' CHECK (queue_status IN ('open', 'snoozed', 'done', 'archived')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  category_id TEXT, -- important, payments, invoices, etc.
  
  -- Snooze support
  snoozed_until TIMESTAMPTZ,
  
  -- Soft delete support
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  deleted_source TEXT CHECK (deleted_source IN ('ovrsee', 'gmail', 'both')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one OVRSEE record per Gmail message per user
  UNIQUE(user_id, gmail_message_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_user_status ON email_queue(user_id, queue_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_queue_gmail_thread_id ON email_queue(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_internal_date ON email_queue(internal_date DESC);
CREATE INDEX IF NOT EXISTS idx_email_queue_snoozed_until ON email_queue(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_queue_deleted_at ON email_queue(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_queue_gmail_history_id ON email_queue(gmail_history_id) WHERE gmail_history_id IS NOT NULL;

-- Enable RLS (Row Level Security)
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own emails
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view own emails" ON public.email_queue CASCADE;
CREATE POLICY "Users can view own emails"
  ON public.email_queue FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can insert their own emails
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can insert own emails" ON public.email_queue CASCADE;
CREATE POLICY "Users can insert own emails"
  ON public.email_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own emails
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can update own emails" ON public.email_queue CASCADE;
CREATE POLICY "Users can update own emails"
  ON public.email_queue FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy: Users can delete their own emails
-- Drop policy if exists
DROP POLICY IF EXISTS "Users can delete own emails" ON public.email_queue CASCADE;
CREATE POLICY "Users can delete own emails"
  ON public.email_queue FOR DELETE
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_email_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_queue_updated_at
  BEFORE UPDATE ON public.email_queue FOR EACH ROW
  EXECUTE FUNCTION update_email_queue_updated_at();

-- Add history_id tracking to gmail_connections for incremental sync
ALTER TABLE gmail_connections 
ADD COLUMN IF NOT EXISTS last_history_id TEXT,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Create index for sync status
CREATE INDEX IF NOT EXISTS idx_gmail_connections_sync_status ON gmail_connections(sync_status) WHERE sync_status = 'error';



-- ============================================================================
-- Migration: 20241215000000_fix_user_creation_trigger.sql
-- ============================================================================
-- Fix: The workspace migration replaced the user creation trigger
-- This migration ensures profiles, subscriptions, AND workspaces are all created

-- Update the workspace creation function to also create profile and subscription
CREATE OR REPLACE FUNCTION create_workspace_for_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile (if it doesn't exist)
  INSERT INTO public.profiles (id, email, full_name, subscription_tier, subscription_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'free',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create default free subscription (if it doesn't exist)
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  -- Create workspace (if it doesn't exist)
  INSERT INTO workspaces (owner_user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'My Workspace'))
  ON CONFLICT (owner_user_id) DO NOTHING;
  
  -- Create owner seat (if it doesn't exist)
  INSERT INTO workspace_seats (workspace_id, user_id, tier, status, is_owner)
  SELECT id, NEW.id, 'basic', 'active', TRUE
  FROM workspaces
  WHERE owner_user_id = NEW.id
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists (it should already exist from the workspace migration)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_workspace_for_user();



-- ============================================================================
-- Migration: 20250101000000_user_phone_number_changes.sql
-- ============================================================================
-- Track user phone number change events (not initial assignments)

CREATE TABLE IF NOT EXISTS user_phone_number_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_phone_number TEXT,
  new_phone_number TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_phone_number_changes_user_id_changed_at
  ON user_phone_number_changes (user_id, changed_at);



