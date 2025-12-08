-- ============================================================================
-- Migration: 20250115000000_core_aloha_schema.sql
-- ============================================================================
-- Core Aloha schema: call_logs, voicemail_messages, aloha_settings, integrations
-- This migration ensures all foundational tables exist for Aloha functionality

-- ============================================================================
-- 1. ENHANCE call_logs table (add workspace support and additional fields)
-- ============================================================================

-- Add workspace_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'call_logs'
      AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.call_logs ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add call status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'call_logs' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.call_logs ADD COLUMN status TEXT DEFAULT 'ringing' 
      CHECK (status IN ('ringing', 'in-progress', 'completed', 'no-answer', 'busy', 'failed', 'voicemail'));
  END IF;

  -- Add call direction
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'call_logs' AND column_name = 'direction'
  ) THEN
    ALTER TABLE public.call_logs ADD COLUMN direction TEXT DEFAULT 'inbound'
      CHECK (direction IN ('inbound', 'outbound'));
  END IF;

  -- Add duration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'call_logs' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE public.call_logs ADD COLUMN duration_seconds INTEGER;
  END IF;

  -- Add recording URL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'call_logs' AND column_name = 'recording_url'
  ) THEN
    ALTER TABLE public.call_logs ADD COLUMN recording_url TEXT;
  END IF;

  -- Add voicemail flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'call_logs' AND column_name = 'has_voicemail'
  ) THEN
    ALTER TABLE public.call_logs ADD COLUMN has_voicemail BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add metadata JSONB
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'call_logs' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.call_logs ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_call_logs_workspace_id ON public.call_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON public.call_logs(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_has_voicemail ON public.call_logs(has_voicemail) WHERE has_voicemail = TRUE;
CREATE INDEX IF NOT EXISTS idx_call_logs_twilio_call_sid ON public.call_logs(twilio_call_sid);

-- ============================================================================
-- 2. CREATE voicemail_messages table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.voicemail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_log_id UUID REFERENCES public.call_logs(id) ON DELETE SET NULL,
  
  -- Twilio data
  twilio_recording_sid TEXT NOT NULL,
  recording_url TEXT NOT NULL,
  recording_duration_seconds INTEGER,
  
  -- Caller info
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  
  -- Transcription & AI
  transcript TEXT,
  transcript_completed_at TIMESTAMPTZ,
  summary TEXT,
  summary_completed_at TIMESTAMPTZ,
  extracted_fields JSONB DEFAULT '{}'::jsonb, -- name, phone, email, reason, priority, etc.
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(twilio_recording_sid)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_workspace_id ON public.voicemail_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_user_id ON public.voicemail_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_call_log_id ON public.voicemail_messages(call_log_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_created_at ON public.voicemail_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_is_read ON public.voicemail_messages(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_twilio_recording_sid ON public.voicemail_messages(twilio_recording_sid);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_voicemail_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_voicemail_messages_updated_at ON public.voicemail_messages;
CREATE TRIGGER trigger_update_voicemail_messages_updated_at
  BEFORE UPDATE ON public.voicemail_messages FOR EACH ROW
  EXECUTE FUNCTION update_voicemail_messages_updated_at();

-- ============================================================================
-- 3. CREATE aloha_settings table (workspace-level Aloha configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.aloha_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Call handling
  greeting_message TEXT,
  voicemail_message TEXT,
  ring_timeout_seconds INTEGER DEFAULT 30,
  max_ring_time_seconds INTEGER DEFAULT 60,
  
  -- Business hours
  business_hours_enabled BOOLEAN DEFAULT FALSE,
  business_hours_start TIME DEFAULT '09:00',
  business_hours_end TIME DEFAULT '17:00',
  business_hours_timezone TEXT DEFAULT 'UTC',
  business_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- 1=Monday, 7=Sunday
  
  -- Call forwarding
  forwarding_enabled BOOLEAN DEFAULT FALSE,
  forwarding_number TEXT,
  
  -- AI settings
  ai_enabled BOOLEAN DEFAULT TRUE,
  ai_tone TEXT DEFAULT 'professional' CHECK (ai_tone IN ('professional', 'friendly', 'casual', 'formal')),
  ai_language TEXT DEFAULT 'en',
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aloha_settings_workspace_id ON public.aloha_settings(workspace_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_aloha_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_aloha_settings_updated_at ON public.aloha_settings;
CREATE TRIGGER trigger_update_aloha_settings_updated_at
  BEFORE UPDATE ON public.aloha_settings FOR EACH ROW
  EXECUTE FUNCTION update_aloha_settings_updated_at();

-- ============================================================================
-- 4. CREATE integrations table (for OAuth tokens, API keys, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Optional: user-specific integrations
  
  -- Integration type
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'google_calendar', 'stripe', 'twilio', 'openai', 'other')),
  integration_type TEXT NOT NULL CHECK (integration_type IN ('oauth', 'api_key', 'webhook', 'other')),
  
  -- Credentials (encrypted in production)
  access_token TEXT, -- For OAuth
  refresh_token TEXT, -- For OAuth
  api_key TEXT, -- For API key integrations
  webhook_secret TEXT, -- For webhook verification
  
  -- OAuth metadata
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[], -- OAuth scopes
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One active integration per provider per workspace
  UNIQUE(workspace_id, provider, integration_type) WHERE is_active = TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integrations_workspace_id ON public.integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON public.integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON public.integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_is_active ON public.integrations(is_active) WHERE is_active = TRUE;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_integrations_updated_at ON public.integrations;
CREATE TRIGGER trigger_update_integrations_updated_at
  BEFORE UPDATE ON public.integrations FOR EACH ROW
  EXECUTE FUNCTION update_integrations_updated_at();

-- ============================================================================
-- 5. UPDATE user_phone_numbers to link to workspace
-- ============================================================================

-- Add workspace_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_phone_numbers'
      AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.user_phone_numbers ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
    
    -- Backfill workspace_id from user's workspace
    UPDATE public.user_phone_numbers upn
    SET workspace_id = w.id
    FROM public.workspaces w
    WHERE w.owner_user_id = upn.user_id
      AND upn.workspace_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_workspace_id ON public.user_phone_numbers(workspace_id);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.voicemail_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aloha_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Voicemail messages policies
DROP POLICY IF EXISTS "workspace_members_can_view_voicemails" ON public.voicemail_messages;
CREATE POLICY "workspace_members_can_view_voicemails"
  ON public.voicemail_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = voicemail_messages.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "workspace_members_can_modify_voicemails" ON public.voicemail_messages;
CREATE POLICY "workspace_members_can_modify_voicemails"
  ON public.voicemail_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = voicemail_messages.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

-- Aloha settings policies
DROP POLICY IF EXISTS "workspace_owners_can_view_aloha_settings" ON public.aloha_settings;
CREATE POLICY "workspace_owners_can_view_aloha_settings"
  ON public.aloha_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = aloha_settings.workspace_id
        AND w.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "workspace_owners_can_modify_aloha_settings" ON public.aloha_settings;
CREATE POLICY "workspace_owners_can_modify_aloha_settings"
  ON public.aloha_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = aloha_settings.workspace_id
        AND w.owner_user_id = auth.uid()
    )
  );

-- Integrations policies
DROP POLICY IF EXISTS "workspace_members_can_view_integrations" ON public.integrations;
CREATE POLICY "workspace_members_can_view_integrations"
  ON public.integrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
      WHERE w.id = integrations.workspace_id
        AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "workspace_owners_can_modify_integrations" ON public.integrations;
CREATE POLICY "workspace_owners_can_modify_integrations"
  ON public.integrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = integrations.workspace_id
        AND w.owner_user_id = auth.uid()
    )
  );

-- Update call_logs RLS if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'call_logs' AND policyname = 'workspace_members_can_view_call_logs'
  ) THEN
    ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "workspace_members_can_view_call_logs"
      ON public.call_logs FOR SELECT
      USING (
        workspace_id IS NULL OR EXISTS (
          SELECT 1 FROM public.workspaces w
          LEFT JOIN public.workspace_seats s ON s.workspace_id = w.id AND s.status = 'active'
          WHERE w.id = call_logs.workspace_id
            AND (w.owner_user_id = auth.uid() OR s.user_id = auth.uid())
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.voicemail_messages IS 'Stores voicemail recordings from Twilio with transcription and AI summaries';
COMMENT ON TABLE public.aloha_settings IS 'Workspace-level Aloha configuration (greeting, business hours, AI settings)';
COMMENT ON TABLE public.integrations IS 'OAuth tokens and API keys for external services (Gmail, Calendar, Stripe, etc.)';
COMMENT ON COLUMN public.call_logs.workspace_id IS 'Workspace that owns this call (for multi-tenant support)';
COMMENT ON COLUMN public.call_logs.status IS 'Call status: ringing, in-progress, completed, no-answer, busy, failed, voicemail';
COMMENT ON COLUMN public.call_logs.has_voicemail IS 'Whether this call resulted in a voicemail message';




