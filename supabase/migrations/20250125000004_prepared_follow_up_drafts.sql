-- Migration: Add prepared follow-up drafts table and last_follow_up_generated_at to leads
-- Supports semi-automatic follow-up sequence generation

-- Add last_follow_up_generated_at to leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS last_follow_up_generated_at TIMESTAMPTZ;

-- Create prepared_follow_up_drafts table
CREATE TABLE IF NOT EXISTS public.prepared_follow_up_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  email_id UUID REFERENCES public.email_queue(id) ON DELETE SET NULL,
  draft_body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  consumed BOOLEAN DEFAULT FALSE,
  consumed_at TIMESTAMPTZ,
  UNIQUE(user_id, lead_id, email_id) -- One draft per lead/email combination
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_prepared_drafts_user_id_consumed ON public.prepared_follow_up_drafts(user_id, consumed) WHERE consumed = FALSE;
CREATE INDEX IF NOT EXISTS idx_prepared_drafts_lead_id ON public.prepared_follow_up_drafts(lead_id);
CREATE INDEX IF NOT EXISTS idx_prepared_drafts_email_id ON public.prepared_follow_up_drafts(email_id);
CREATE INDEX IF NOT EXISTS idx_leads_last_follow_up_generated_at ON public.leads(user_id, last_follow_up_generated_at);

-- RLS policies
ALTER TABLE public.prepared_follow_up_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own prepared drafts"
  ON public.prepared_follow_up_drafts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own prepared drafts"
  ON public.prepared_follow_up_drafts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prepared drafts"
  ON public.prepared_follow_up_drafts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE public.prepared_follow_up_drafts IS 'Pre-generated follow-up drafts ready for user review and sending';
COMMENT ON COLUMN public.prepared_follow_up_drafts.consumed IS 'True when the draft has been used (sent or dismissed)';
COMMENT ON COLUMN public.leads.last_follow_up_generated_at IS 'Timestamp of when the last automatic follow-up draft was generated for this lead';


