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
CREATE INDEX IF NOT EXISTS idx_call_campaigns_allowed_days ON call_campaigns USING GIN(allowed_days_of_week);
CREATE INDEX IF NOT EXISTS idx_call_campaign_targets_metadata ON call_campaign_targets USING GIN(contact_metadata);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_gaps_metadata ON agent_knowledge_gaps USING GIN(context_metadata);

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
  BEFORE UPDATE ON call_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_call_campaigns_updated_at();

DROP TRIGGER IF EXISTS trigger_update_call_campaign_targets_updated_at ON call_campaign_targets;
CREATE TRIGGER trigger_update_call_campaign_targets_updated_at
  BEFORE UPDATE ON call_campaign_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_call_campaign_targets_updated_at();

DROP TRIGGER IF EXISTS trigger_update_agent_knowledge_gaps_updated_at ON agent_knowledge_gaps;
CREATE TRIGGER trigger_update_agent_knowledge_gaps_updated_at
  BEFORE UPDATE ON agent_knowledge_gaps
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_knowledge_gaps_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE call_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_campaign_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_gaps ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own campaigns
CREATE POLICY "Users can view their own call campaigns"
  ON call_campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own call campaigns"
  ON call_campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own call campaigns"
  ON call_campaigns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own call campaigns"
  ON call_campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for campaign targets
CREATE POLICY "Users can view targets for their campaigns"
  ON call_campaign_targets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM call_campaigns
      WHERE call_campaigns.id = call_campaign_targets.campaign_id
      AND call_campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert targets for their campaigns"
  ON call_campaign_targets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM call_campaigns
      WHERE call_campaigns.id = call_campaign_targets.campaign_id
      AND call_campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update targets for their campaigns"
  ON call_campaign_targets FOR UPDATE
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

CREATE POLICY "Users can delete targets for their campaigns"
  ON call_campaign_targets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM call_campaigns
      WHERE call_campaigns.id = call_campaign_targets.campaign_id
      AND call_campaigns.user_id = auth.uid()
    )
  );

-- RLS Policies for knowledge gaps
CREATE POLICY "Users can view their own knowledge gaps"
  ON agent_knowledge_gaps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own knowledge gaps"
  ON agent_knowledge_gaps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge gaps"
  ON agent_knowledge_gaps FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge gaps"
  ON agent_knowledge_gaps FOR DELETE
  USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE call_campaigns IS 'Call campaigns for Aloha agent. Campaigns only run when explicitly started by user and respect time window rules.';
COMMENT ON TABLE call_campaign_targets IS 'Individual phone numbers to call in a campaign. Tracks call attempts and outcomes.';
COMMENT ON TABLE agent_knowledge_gaps IS 'Tracks when agents encounter missing information. Agents log gaps instead of inventing information.';
COMMENT ON COLUMN call_campaigns.allowed_days_of_week IS 'Array of day abbreviations: ["mon","tue","wed","thu","fri","sat","sun"]';
COMMENT ON COLUMN call_campaigns.timezone IS 'IANA timezone string (e.g., "America/New_York") for time window calculations';
COMMENT ON COLUMN agent_knowledge_gaps.context_id IS 'Flexible reference to source (call_log id, email thread id, conversation id, etc.)';








