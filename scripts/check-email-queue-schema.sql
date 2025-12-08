-- Quick check script to verify email_queue schema
-- Run this to see if priority_score and category columns exist

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'email_queue'
  AND column_name IN ('priority_score', 'category', 'classification_status', 'classification_raw')
ORDER BY column_name;

-- If columns are missing, run:
-- supabase/migrations/20250125000002_ensure_email_queue_columns.sql

