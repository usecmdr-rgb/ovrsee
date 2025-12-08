-- Create integrations table for OAuth tokens and API keys
-- This table stores Google OAuth tokens for Gmail and Calendar integration

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
  sync_status TEXT CHECK (sync_status IN ('connected', 'error', 'disconnected')) DEFAULT 'connected',
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integrations_workspace_id ON public.integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON public.integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON public.integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_is_active ON public.integrations(is_active) WHERE is_active = TRUE;

-- Partial unique index: One active integration per provider per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_unique_active 
  ON public.integrations(workspace_id, provider, integration_type) 
  WHERE is_active = TRUE;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS update_integrations_updated_at ON public.integrations;

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_integrations_updated_at();

-- Enable RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view integrations for their workspaces
CREATE POLICY "Users can view integrations for their workspaces"
  ON public.integrations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = integrations.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
  );

-- Users can insert integrations for their workspaces
CREATE POLICY "Users can insert integrations for their workspaces"
  ON public.integrations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = integrations.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
  );

-- Users can update integrations for their workspaces
CREATE POLICY "Users can update integrations for their workspaces"
  ON public.integrations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = integrations.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
  );

-- Users can delete integrations for their workspaces
CREATE POLICY "Users can delete integrations for their workspaces"
  ON public.integrations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = integrations.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
  );

