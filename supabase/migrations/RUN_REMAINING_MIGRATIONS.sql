-- ============================================================================
-- RUN REMAINING MIGRATIONS (Skip Already Applied)
-- ============================================================================
-- This script starts AFTER the gmail and calendar connections sections
-- which have already been applied. Copy and paste this into Supabase SQL Editor.
-- ============================================================================

-- First, let's manually drop the problematic policies to ensure clean state
DO $$
BEGIN
  -- Drop gmail policies if they exist
  DROP POLICY IF EXISTS "Users can view own Gmail connections" ON public.gmail_connections;
  DROP POLICY IF EXISTS "Users can insert own Gmail connections" ON public.gmail_connections;
  DROP POLICY IF EXISTS "Users can update own Gmail connections" ON public.gmail_connections;
  DROP POLICY IF EXISTS "Users can delete own Gmail connections" ON public.gmail_connections;
  
  -- Drop calendar policies if they exist
  DROP POLICY IF EXISTS "Users can view own calendar connections" ON public.calendar_connections;
  DROP POLICY IF EXISTS "Users can insert own calendar connections" ON public.calendar_connections;
  DROP POLICY IF EXISTS "Users can update own calendar connections" ON public.calendar_connections;
  DROP POLICY IF EXISTS "Users can delete own calendar connections" ON public.calendar_connections;
  DROP POLICY IF EXISTS "Users can view own event notes" ON public.calendar_event_notes;
  DROP POLICY IF EXISTS "Users can insert own event notes" ON public.calendar_event_notes;
  DROP POLICY IF EXISTS "Users can update own event notes" ON public.calendar_event_notes;
  DROP POLICY IF EXISTS "Users can delete own event notes" ON public.calendar_event_notes;
END $$;

-- Now continue with the rest of the migrations from the combined file
-- (You'll need to copy from line ~370 onwards from ALL_MIGRATIONS_COMBINED.sql)
