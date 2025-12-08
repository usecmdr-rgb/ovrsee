-- Migration: Ensure all required columns exist in email_queue
-- This migration ensures category and priority_score columns exist
-- Safe to run multiple times (idempotent)

-- ============================================================================
-- 1) Ensure category column exists
-- ============================================================================
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

-- ============================================================================
-- 2) Ensure priority_score column exists
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'email_queue' 
      AND column_name = 'priority_score'
  ) THEN
    ALTER TABLE public.email_queue
    ADD COLUMN priority_score INTEGER DEFAULT 0 CHECK (priority_score >= 0);
    
    -- Create index for priority sorting
    CREATE INDEX IF NOT EXISTS idx_email_queue_user_id_priority_score ON public.email_queue(user_id, priority_score) WHERE deleted_at IS NULL;
    
    -- Add comment
    COMMENT ON COLUMN public.email_queue.priority_score IS 'Computed priority score for email sorting (0-100+)';
  END IF;
END $$;

-- ============================================================================
-- 3) Ensure classification_status column exists (from Phase 1)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'email_queue' 
      AND column_name = 'classification_status'
  ) THEN
    ALTER TABLE public.email_queue
    ADD COLUMN classification_status TEXT DEFAULT 'pending' CHECK (classification_status IN ('pending', 'completed', 'failed'));
  END IF;
END $$;

-- ============================================================================
-- 4) Ensure classification_raw column exists (from Phase 2)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'email_queue' 
      AND column_name = 'classification_raw'
  ) THEN
    ALTER TABLE public.email_queue
    ADD COLUMN classification_raw JSONB;
    
    COMMENT ON COLUMN public.email_queue.classification_raw IS 'Full JSON response from AI classification for debugging';
  END IF;
END $$;


