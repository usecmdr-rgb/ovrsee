-- ============================================================================
-- Migration: 20250116000001_rename_last_sync_at_to_last_synced_at.sql
-- ============================================================================
-- Safely rename last_sync_at to last_synced_at on public.integrations table
-- This migration is idempotent and safe to run multiple times

-- ============================================================================
-- Rename column: last_sync_at → last_synced_at
-- ============================================================================

DO $$
BEGIN
  -- Check if last_sync_at exists and last_synced_at doesn't exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'integrations'
      AND column_name = 'last_sync_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'integrations'
      AND column_name = 'last_synced_at'
  ) THEN
    -- Safe rename: last_sync_at → last_synced_at
    ALTER TABLE public.integrations
    RENAME COLUMN last_sync_at TO last_synced_at;
    
    RAISE NOTICE 'Renamed column last_sync_at to last_synced_at on public.integrations';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'integrations'
      AND column_name = 'last_synced_at'
  ) THEN
    -- Column already renamed or already exists with correct name
    RAISE NOTICE 'Column last_synced_at already exists on public.integrations';
    
    -- If both columns exist (shouldn't happen, but handle gracefully)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'integrations'
        AND column_name = 'last_sync_at'
    ) THEN
      -- Copy data from old column to new column if new column is NULL
      UPDATE public.integrations
      SET last_synced_at = last_sync_at
      WHERE last_synced_at IS NULL AND last_sync_at IS NOT NULL;
      
      -- Drop the old column
      ALTER TABLE public.integrations
      DROP COLUMN last_sync_at;
      
      RAISE NOTICE 'Merged last_sync_at into last_synced_at and dropped old column';
    END IF;
  ELSE
    -- Neither column exists, nothing to do
    RAISE NOTICE 'No last_sync_at or last_synced_at column found on public.integrations';
  END IF;
END $$;

-- ============================================================================
-- Add comment
-- ============================================================================

COMMENT ON COLUMN public.integrations.last_synced_at IS 
  'Timestamp of the last successful sync operation for this integration';



