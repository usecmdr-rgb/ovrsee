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
CREATE POLICY "Users can view own emails"
  ON email_queue
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can insert their own emails
CREATE POLICY "Users can insert own emails"
  ON email_queue
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own emails
CREATE POLICY "Users can update own emails"
  ON email_queue
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy: Users can delete their own emails
CREATE POLICY "Users can delete own emails"
  ON email_queue
  FOR DELETE
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
  BEFORE UPDATE ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_email_queue_updated_at();

-- Add history_id tracking to gmail_connections for incremental sync
ALTER TABLE gmail_connections 
ADD COLUMN IF NOT EXISTS last_history_id TEXT,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Create index for sync status
CREATE INDEX IF NOT EXISTS idx_gmail_connections_sync_status ON gmail_connections(sync_status) WHERE sync_status = 'error';



