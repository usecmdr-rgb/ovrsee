-- Migration: CRM & Lead Scoring Schema
-- Creates tables for contacts, leads, follow-up suggestions, and contact notes
-- Supports Sync's CRM features, lead scoring, and follow-up automation

-- ============================================================================
-- 1) Contacts Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  role TEXT,
  phone TEXT,
  
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One contact per user per email
  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id_email ON public.contacts(user_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id_last_seen_at ON public.contacts(user_id, last_seen_at);

-- ============================================================================
-- 2) Leads Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  
  lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  lead_stage TEXT DEFAULT 'new' CHECK (lead_stage IN ('new', 'cold', 'qualified', 'warm', 'negotiating', 'ready_to_close', 'won', 'lost')),
  
  primary_service_id UUID REFERENCES public.business_services(id) ON DELETE SET NULL,
  budget TEXT,
  timeline TEXT,
  
  last_email_id UUID REFERENCES public.email_queue(id) ON DELETE SET NULL,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_follow_up_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON public.leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id_lead_score ON public.leads(user_id, lead_score);
CREATE INDEX IF NOT EXISTS idx_leads_user_id_lead_stage ON public.leads(user_id, lead_stage);
CREATE INDEX IF NOT EXISTS idx_leads_user_id_next_follow_up_at ON public.leads(user_id, next_follow_up_at);
CREATE INDEX IF NOT EXISTS idx_leads_user_id_last_activity_at ON public.leads(user_id, last_activity_at);

-- ============================================================================
-- 3) Lead Follow-Up Suggestions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lead_follow_up_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  email_id UUID REFERENCES public.email_queue(id) ON DELETE SET NULL,
  
  reason TEXT NOT NULL,
  suggested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suggested_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'dismissed')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_follow_up_suggestions_user_id ON public.lead_follow_up_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_up_suggestions_lead_id ON public.lead_follow_up_suggestions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_up_suggestions_user_status_suggested_for ON public.lead_follow_up_suggestions(user_id, status, suggested_for);

-- ============================================================================
-- 4) Contact Notes Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  
  body TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_notes_user_id ON public.contact_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_contact_id ON public.contact_notes(contact_id);

-- ============================================================================
-- 5) Add priority_score to email_queue
-- ============================================================================
ALTER TABLE public.email_queue
ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0 CHECK (priority_score >= 0);

CREATE INDEX IF NOT EXISTS idx_email_queue_user_id_priority_score ON public.email_queue(user_id, priority_score) WHERE deleted_at IS NULL;

-- ============================================================================
-- 6) Add follow_up_threshold_days to user_sync_preferences
-- ============================================================================
ALTER TABLE public.user_sync_preferences
ADD COLUMN IF NOT EXISTS follow_up_threshold_days INTEGER DEFAULT 5 CHECK (follow_up_threshold_days >= 1 AND follow_up_threshold_days <= 30);

COMMENT ON COLUMN public.user_sync_preferences.follow_up_threshold_days IS 'Number of days after last activity before suggesting a follow-up (1-30)';

-- ============================================================================
-- 7) Updated_at Triggers
-- ============================================================================
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_follow_up_suggestions_updated_at
  BEFORE UPDATE ON public.lead_follow_up_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_notes_updated_at
  BEFORE UPDATE ON public.contact_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8) Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_follow_up_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

-- Contacts policies
CREATE POLICY "users_can_view_own_contacts"
  ON public.contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_modify_own_contacts"
  ON public.contacts FOR ALL
  USING (auth.uid() = user_id);

-- Leads policies
CREATE POLICY "users_can_view_own_leads"
  ON public.leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_modify_own_leads"
  ON public.leads FOR ALL
  USING (auth.uid() = user_id);

-- Lead follow-up suggestions policies
CREATE POLICY "users_can_view_own_follow_up_suggestions"
  ON public.lead_follow_up_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_modify_own_follow_up_suggestions"
  ON public.lead_follow_up_suggestions FOR ALL
  USING (auth.uid() = user_id);

-- Contact notes policies
CREATE POLICY "users_can_view_own_contact_notes"
  ON public.contact_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_modify_own_contact_notes"
  ON public.contact_notes FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- 9) Comments
-- ============================================================================
COMMENT ON TABLE public.contacts IS 'Contact information extracted from emails';
COMMENT ON TABLE public.leads IS 'Sales leads with scoring and stage tracking';
COMMENT ON TABLE public.lead_follow_up_suggestions IS 'AI-generated follow-up suggestions for leads';
COMMENT ON TABLE public.contact_notes IS 'Manual notes attached to contacts';
COMMENT ON COLUMN public.email_queue.priority_score IS 'Computed priority score for email sorting (0-100+)';


