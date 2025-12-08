-- Migration: Add Sync Intelligence Processing Fields and Tables
-- Phase 1: Automatic classification, appointment detection, task extraction
-- Based on SYNC_INTELLIGENCE_UPGRADE_SPEC.md

-- ============================================================================
-- 1. Add processing status fields to email_queue
-- ============================================================================

-- Classification status tracking
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS classification_status TEXT DEFAULT 'pending' 
  CHECK (classification_status IN ('pending', 'processing', 'completed', 'failed'));

ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS classification_attempted_at TIMESTAMPTZ;

-- Appointment detection flags
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS has_appointment BOOLEAN DEFAULT false;

ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS appointment_detected_at TIMESTAMPTZ;

-- Task detection flags
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS has_tasks BOOLEAN DEFAULT false;

ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS tasks_detected_at TIMESTAMPTZ;

-- Indexes for processing queries
CREATE INDEX IF NOT EXISTS idx_email_queue_classification_status 
ON email_queue(user_id, classification_status) 
WHERE classification_status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_queue_has_appointment 
ON email_queue(user_id, has_appointment) 
WHERE has_appointment = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_queue_has_tasks 
ON email_queue(user_id, has_tasks) 
WHERE has_tasks = true AND deleted_at IS NULL;

-- Comments
COMMENT ON COLUMN email_queue.classification_status IS 'Processing status for automatic classification: pending, processing, completed, failed';
COMMENT ON COLUMN email_queue.has_appointment IS 'True if appointment/meeting detected in email';
COMMENT ON COLUMN email_queue.has_tasks IS 'True if tasks/action items detected in email';

-- ============================================================================
-- 2. Create email_appointments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES email_queue(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Appointment data
  appointment_type TEXT NOT NULL CHECK (appointment_type IN ('request', 'proposal', 'confirmation', 'invitation')),
  title TEXT NOT NULL,
  description TEXT,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  timezone TEXT DEFAULT 'America/New_York',
  location TEXT,
  duration_minutes INTEGER DEFAULT 60,
  attendees TEXT[], -- Array of email addresses
  
  -- Status
  calendar_event_id TEXT, -- If created in Google Calendar
  calendar_event_created_at TIMESTAMPTZ,
  status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'calendar_created', 'user_confirmed', 'cancelled')),
  
  -- AI metadata
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  extraction_raw JSONB, -- Full AI response for debugging
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One appointment per email (can have multiple, but track primary)
  UNIQUE(email_id)
);

CREATE INDEX IF NOT EXISTS idx_email_appointments_user_id 
ON email_appointments(user_id, status) 
WHERE status IN ('detected', 'calendar_created');

CREATE INDEX IF NOT EXISTS idx_email_appointments_date 
ON email_appointments(appointment_date, appointment_time) 
WHERE status != 'cancelled';

-- RLS policies
ALTER TABLE email_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own appointments"
  ON email_appointments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own appointments"
  ON email_appointments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own appointments"
  ON email_appointments FOR UPDATE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_email_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_appointments_updated_at
  BEFORE UPDATE ON email_appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_email_appointments_updated_at();

-- ============================================================================
-- 3. Create email_tasks table
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES email_queue(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Task data
  description TEXT NOT NULL,
  due_date DATE,
  due_time TIME,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  
  -- Recurring
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('daily', 'weekly', 'monthly')),
  recurring_end_date DATE,
  
  -- Assignment
  assignee_email TEXT, -- If task assigned to someone else
  
  -- Metadata
  extraction_raw JSONB, -- Full AI response
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_tasks_user_status 
ON email_tasks(user_id, status) 
WHERE status IN ('open', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_email_tasks_due_date 
ON email_tasks(due_date, due_time) 
WHERE status = 'open' AND due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_tasks_email_id 
ON email_tasks(email_id);

-- RLS policies
ALTER TABLE email_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON email_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
  ON email_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON email_tasks FOR UPDATE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_email_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_tasks_updated_at
  BEFORE UPDATE ON email_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_email_tasks_updated_at();

-- ============================================================================
-- 4. Create email_reminders table
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES email_queue(id) ON DELETE CASCADE,
  task_id UUID REFERENCES email_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Reminder data
  message TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed', 'cancelled')),
  
  -- Notification
  notification_sent_at TIMESTAMPTZ,
  notification_method TEXT CHECK (notification_method IN ('in_app', 'email', 'push')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_reminders_user_pending 
ON email_reminders(user_id, remind_at) 
WHERE status = 'pending' AND remind_at <= NOW() + INTERVAL '1 day';

CREATE INDEX IF NOT EXISTS idx_email_reminders_remind_at 
ON email_reminders(remind_at) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_email_reminders_email_id 
ON email_reminders(email_id);

CREATE INDEX IF NOT EXISTS idx_email_reminders_task_id 
ON email_reminders(task_id);

-- RLS policies
ALTER TABLE email_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders"
  ON email_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders"
  ON email_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
  ON email_reminders FOR UPDATE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_email_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_reminders_updated_at
  BEFORE UPDATE ON email_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_email_reminders_updated_at();

-- ============================================================================
-- 5. Create user_sync_preferences table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_sync_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Auto-creation preferences
  auto_create_calendar_events BOOLEAN DEFAULT false,
  auto_create_tasks BOOLEAN DEFAULT false,
  auto_create_reminders BOOLEAN DEFAULT true,
  
  -- Notification preferences
  reminder_notification_method TEXT DEFAULT 'in_app' 
    CHECK (reminder_notification_method IN ('in_app', 'email', 'push', 'all')),
  
  -- Calendar preferences
  default_calendar_duration_minutes INTEGER DEFAULT 60,
  default_calendar_timezone TEXT DEFAULT 'America/New_York',
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE user_sync_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON user_sync_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_sync_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_sync_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_user_sync_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_sync_preferences_updated_at
  BEFORE UPDATE ON user_sync_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sync_preferences_updated_at();


