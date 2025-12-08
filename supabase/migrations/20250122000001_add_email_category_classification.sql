-- Migration: Add AI-powered email categorization
-- Updates category_id to category with fixed set of values
-- Adds classification_raw for debugging

-- First, rename category_id to category if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_queue' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE email_queue RENAME COLUMN category_id TO category;
  END IF;
END $$;

-- Add category column if it doesn't exist
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('important', 'missed_unread', 'payment_bill', 'invoice', 'marketing', 'updates', 'other'));

-- Add classification_raw column for storing full AI response
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS classification_raw JSONB;

-- Update existing category values to match new schema
-- Map old values to new ones
UPDATE email_queue
SET category = CASE
  WHEN category = 'important' THEN 'important'
  WHEN category = 'payments' THEN 'payment_bill'
  WHEN category = 'invoices' THEN 'invoice'
  WHEN category = 'meetings' THEN 'other'
  WHEN category = 'subscriptions' THEN 'other'
  WHEN category = 'missed' THEN 'missed_unread'
  ELSE 'other'
END
WHERE category IS NOT NULL;

-- Set NULL categories to NULL (they'll be treated as 'other' in the app)
-- No need to update NULL values

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_email_queue_category ON email_queue(user_id, category) WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN email_queue.category IS 'AI-classified category: important, missed_unread, payment_bill, invoice, marketing, updates, or other';
COMMENT ON COLUMN email_queue.classification_raw IS 'Full JSON response from AI classification for debugging';

