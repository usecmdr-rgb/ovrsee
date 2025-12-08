-- Migration: Consolidate sync_email_messages to email_queue
-- Phase 1: Backfill data from sync_email_messages to email_queue
-- Based on SYNC_INTELLIGENCE_UPGRADE_SPEC.md

-- This migration copies data from sync_email_messages to email_queue
-- Deduplicates by gmail_message_id (external_id in sync_email_messages)

-- Note: This is a one-time migration. After this, sync_email_messages is deprecated.

INSERT INTO email_queue (
  user_id,
  gmail_message_id,
  gmail_thread_id,
  gmail_labels,
  from_address,
  to_addresses,
  cc_addresses,
  bcc_addresses,
  subject,
  snippet,
  body_html,
  body_text,
  internal_date,
  is_read,
  is_starred,
  queue_status,
  classification_status,
  created_at,
  updated_at
)
SELECT 
  w.owner_user_id as user_id,
  sem.external_id as gmail_message_id,
  COALESCE(sem.thread_id, sem.external_id) as gmail_thread_id, -- Use external_id as fallback
  COALESCE(sem.labels, ARRAY[]::TEXT[]) as gmail_labels,
  COALESCE(sem.from_address, '') as from_address,
  COALESCE(sem.to_addresses, ARRAY[]::TEXT[]) as to_addresses,
  COALESCE(sem.cc_addresses, ARRAY[]::TEXT[]) as cc_addresses,
  COALESCE(sem.bcc_addresses, ARRAY[]::TEXT[]) as bcc_addresses,
  COALESCE(sem.subject, '(No subject)') as subject,
  sem.snippet,
  NULL as body_html, -- sync_email_messages doesn't store body
  NULL as body_text,
  COALESCE(sem.internal_date, NOW()) as internal_date,
  COALESCE(sem.is_read, false) as is_read,
  COALESCE(sem.is_important, false) as is_starred, -- Map is_important to is_starred
  CASE 
    WHEN 'INBOX' = ANY(COALESCE(sem.labels, ARRAY[]::TEXT[])) THEN 'open'
    ELSE 'archived'
  END as queue_status,
  'pending' as classification_status, -- Mark as pending for automatic classification
  sem.created_at,
  sem.updated_at
FROM sync_email_messages sem
JOIN integrations i ON sem.integration_id = i.id
JOIN workspaces w ON i.workspace_id = w.id
WHERE NOT EXISTS (
  SELECT 1 FROM email_queue eq 
  WHERE eq.user_id = w.owner_user_id 
    AND eq.gmail_message_id = sem.external_id
)
ON CONFLICT (user_id, gmail_message_id) DO NOTHING;

-- Add comment to mark sync_email_messages as deprecated
COMMENT ON TABLE sync_email_messages IS 'DEPRECATED: This table is no longer used. All email data should be in email_queue. This table is kept for historical reference and will be removed in a future migration.';


