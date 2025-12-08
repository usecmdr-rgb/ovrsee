-- Migration: Phase 6 - Opportunities, Sequences, Revenue Tracking
-- Combines A) Opportunity Detection, B) Multi-Step Sequences, C) Revenue Tracking

-- ============================================================================
-- A) LEAD OPPORTUNITIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lead_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  email_id UUID NOT NULL REFERENCES public.email_queue(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('buying_signal', 'risk', 'competitor', 'upsell', 'renewal')),
  strength TEXT NOT NULL CHECK (strength IN ('low', 'medium', 'high')),
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, lead_id, email_id, type) -- One opportunity per type per email
);

CREATE INDEX IF NOT EXISTS idx_lead_opportunities_user_id ON public.lead_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_opportunities_lead_id ON public.lead_opportunities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_opportunities_email_id ON public.lead_opportunities(email_id);
CREATE INDEX IF NOT EXISTS idx_lead_opportunities_type ON public.lead_opportunities(type);

-- RLS
ALTER TABLE public.lead_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_opportunities"
  ON public.lead_opportunities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_modify_own_opportunities"
  ON public.lead_opportunities FOR ALL
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.lead_opportunities IS 'AI-detected opportunities (buying signals, risks, competitors) from email content';

-- ============================================================================
-- B) FOLLOW-UP SEQUENCES TABLES
-- ============================================================================

-- 1) follow_up_sequences
CREATE TABLE IF NOT EXISTS public.follow_up_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_user_id ON public.follow_up_sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_user_id_default ON public.follow_up_sequences(user_id, is_default);

-- 2) follow_up_sequence_steps
CREATE TABLE IF NOT EXISTS public.follow_up_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES public.follow_up_sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL CHECK (step_order >= 1),
  days_after_last_activity INTEGER NOT NULL CHECK (days_after_last_activity >= 0),
  label TEXT NOT NULL,
  intensity TEXT NOT NULL CHECK (intensity IN ('light', 'normal', 'strong')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(sequence_id, step_order) -- One step per order per sequence
);

CREATE INDEX IF NOT EXISTS idx_follow_up_sequence_steps_sequence_id ON public.follow_up_sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_sequence_steps_sequence_order ON public.follow_up_sequence_steps(sequence_id, step_order);

-- RLS for sequences
ALTER TABLE public.follow_up_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_sequences"
  ON public.follow_up_sequences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_modify_own_sequences"
  ON public.follow_up_sequences FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_view_own_sequence_steps"
  ON public.follow_up_sequence_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.follow_up_sequences
      WHERE follow_up_sequences.id = follow_up_sequence_steps.sequence_id
      AND follow_up_sequences.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_modify_own_sequence_steps"
  ON public.follow_up_sequence_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.follow_up_sequences
      WHERE follow_up_sequences.id = follow_up_sequence_steps.sequence_id
      AND follow_up_sequences.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.follow_up_sequences IS 'Multi-step follow-up sequences for leads';
COMMENT ON TABLE public.follow_up_sequence_steps IS 'Individual steps in a follow-up sequence';

-- ============================================================================
-- C) REVENUE TRACKING - EXTEND LEADS TABLE
-- ============================================================================
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS potential_value NUMERIC,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS closed_value NUMERIC,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS primary_opportunity_type TEXT CHECK (primary_opportunity_type IN ('buying_signal', 'risk', 'competitor', 'upsell', 'renewal')),
ADD COLUMN IF NOT EXISTS primary_opportunity_strength TEXT CHECK (primary_opportunity_strength IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS sequence_id UUID REFERENCES public.follow_up_sequences(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS next_sequence_step_order INTEGER;

CREATE INDEX IF NOT EXISTS idx_leads_user_id_potential_value ON public.leads(user_id, potential_value) WHERE potential_value IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_user_id_closed_value ON public.leads(user_id, closed_value) WHERE closed_value IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_sequence_id ON public.leads(sequence_id) WHERE sequence_id IS NOT NULL;

COMMENT ON COLUMN public.leads.potential_value IS 'Estimated potential revenue value for this lead';
COMMENT ON COLUMN public.leads.currency IS 'Currency code for potential_value and closed_value (default: USD)';
COMMENT ON COLUMN public.leads.closed_value IS 'Actual revenue when lead is won';
COMMENT ON COLUMN public.leads.closed_at IS 'Timestamp when lead was closed (won)';
COMMENT ON COLUMN public.leads.primary_opportunity_type IS 'Highest strength opportunity type detected';
COMMENT ON COLUMN public.leads.primary_opportunity_strength IS 'Strength of primary opportunity';
COMMENT ON COLUMN public.leads.sequence_id IS 'Follow-up sequence assigned to this lead';
COMMENT ON COLUMN public.leads.next_sequence_step_order IS 'Next step order in the assigned sequence';

-- Updated_at trigger for sequences
CREATE TRIGGER update_follow_up_sequences_updated_at
  BEFORE UPDATE ON public.follow_up_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_up_sequence_steps_updated_at
  BEFORE UPDATE ON public.follow_up_sequence_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


