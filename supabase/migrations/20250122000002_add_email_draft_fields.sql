-- Migration: Add AI draft generation fields to email_queue
-- Adds columns for storing AI-generated draft replies

ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS ai_draft TEXT,
ADD COLUMN IF NOT EXISTS ai_draft_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_draft_model TEXT;

-- Create index for draft queries
CREATE INDEX IF NOT EXISTS idx_email_queue_ai_draft_generated_at 
ON email_queue(user_id, ai_draft_generated_at) 
WHERE ai_draft IS NOT NULL;

-- Add comments
COMMENT ON COLUMN email_queue.ai_draft IS 'AI-generated draft reply text';
COMMENT ON COLUMN email_queue.ai_draft_generated_at IS 'Timestamp when draft was generated';
COMMENT ON COLUMN email_queue.ai_draft_model IS 'OpenAI model used to generate the draft';


