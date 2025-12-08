-- Migration: Ensure category column exists in email_queue
-- This migration is idempotent and safe to run multiple times
-- Fixes PostgREST schema cache issue where category column is not found

-- Add category column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'email_queue' 
      AND column_name = 'category'
  ) THEN
    ALTER TABLE public.email_queue 
    ADD COLUMN category TEXT CHECK (category IN ('important', 'missed_unread', 'payment_bill', 'invoice', 'marketing', 'updates', 'other'));
    
    -- Create index for category filtering
    CREATE INDEX IF NOT EXISTS idx_email_queue_category ON public.email_queue(user_id, category) WHERE deleted_at IS NULL;
    
    -- Add comment
    COMMENT ON COLUMN public.email_queue.category IS 'AI-classified category: important, missed_unread, payment_bill, invoice, marketing, updates, or other';
  END IF;
END $$;

-- Refresh PostgREST schema cache (if using PostgREST)
-- Note: This requires PostgREST to be restarted or schema cache to be refreshed
-- The column should now be available after this migration runs


