-- Migration: Create user_settings and user_connected_accounts tables
-- This migration creates tables for user preferences and connected account management

-- ============================================================================
-- user_settings table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  notif_daily_summary BOOLEAN NOT NULL DEFAULT TRUE,
  notif_payment_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  notif_weekly_digest BOOLEAN NOT NULL DEFAULT TRUE,
  notif_missed_calls BOOLEAN NOT NULL DEFAULT TRUE,
  notif_subscription_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER set_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own settings"
  ON public.user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- user_connected_accounts table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'gmail' | 'outlook' | 'google_calendar' | 'instagram' | 'tiktok' | 'youtube' | 'x' | 'linkedin' | ...
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  scopes TEXT[] NOT NULL DEFAULT '{}',
  external_account_id TEXT, -- provider user id / channel id
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_connected_accounts_user_id ON public.user_connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_connected_accounts_provider ON public.user_connected_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_user_connected_accounts_user_provider ON public.user_connected_accounts(user_id, provider);

-- Unique constraint: one account per provider per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_connected_accounts_unique 
  ON public.user_connected_accounts(user_id, provider);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_user_connected_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_connected_accounts_updated_at ON public.user_connected_accounts;
CREATE TRIGGER set_user_connected_accounts_updated_at
  BEFORE UPDATE ON public.user_connected_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_user_connected_accounts_updated_at();

-- Enable RLS
ALTER TABLE public.user_connected_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users manage own connected accounts"
  ON public.user_connected_accounts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Function to ensure user_settings exists for new users
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user_settings when a user signs up
DROP TRIGGER IF EXISTS create_user_settings_on_signup ON auth.users;
CREATE TRIGGER create_user_settings_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_settings();

