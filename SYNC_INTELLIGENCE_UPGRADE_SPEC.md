# OVRSEE Sync Intelligence Upgrade Specification

**Version:** 1.0  
**Date:** January 2025  
**Based On:** SYNC_ARCHITECTURE_AUDIT.md  
**Status:** Specification Only (No Code Implementation)

---

## Executive Summary

This specification defines the technical plan for upgrading OVRSEE Sync from a manual, on-demand system to an intelligent, automatic email processing pipeline. The upgrade adds automatic classification, appointment detection, task extraction, reminders, and calendar integration while maintaining compatibility with existing features.

**Key Principles:**
- Use existing 7-category system (no new categories)
- Consolidate to `email_queue` table (migrate from `sync_email_messages`)
- Maintain backward compatibility
- Add intelligence without breaking existing workflows

---

## 1. Automatic Email Classification Pipeline

### 1.1 Overview

Transform email classification from on-demand API calls to automatic background processing triggered by new email arrivals.

### 1.2 Trigger: New Email Arrival

**Current State:**
- Emails arrive via `incrementalGmailSync()` or `initialGmailSync()`
- Stored in `email_queue` table with `category = NULL`
- Classification only happens via `/api/sync/email/categorize` (user-triggered)

**New State:**
- Emails arrive and are stored with `category = NULL` and `classification_status = 'pending'`
- Background job processor automatically classifies emails with `classification_status = 'pending'`
- Classification happens within 1-5 minutes of email arrival

### 1.3 Database Consolidation Decision

**Decision: Use `email_queue` as the single source of truth**

**Rationale:**
- `email_queue` has more complete schema (queue_status, snoozed_until, ai_draft fields)
- Already integrated with UI (`app/sync/page.tsx`)
- Has proper indexes and RLS policies
- `sync_email_messages` appears to be newer but less integrated

**Migration Plan:**
1. **Phase 1:** Update `lib/sync/runGmailSync.ts` to write to `email_queue` instead of `sync_email_messages`
2. **Phase 2:** Create one-time migration script to copy any existing data from `sync_email_messages` to `email_queue` (deduplicate by `gmail_message_id`)
3. **Phase 3:** Deprecate `sync_email_messages` table (mark as unused, don't delete immediately)
4. **Phase 4:** Update all references to use `email_queue` only

**Schema Addition:**
```sql
-- Add to email_queue table
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS classification_status TEXT DEFAULT 'pending' 
  CHECK (classification_status IN ('pending', 'processing', 'completed', 'failed'));

ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS classification_attempted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_email_queue_classification_status 
ON email_queue(user_id, classification_status) 
WHERE classification_status = 'pending' AND deleted_at IS NULL;
```

### 1.4 Automatic Classification Flow

**Step 1: Email Arrival**
- `incrementalGmailSync()` or `initialGmailSync()` inserts email into `email_queue`
- Sets `classification_status = 'pending'`
- Sets `classification_attempted_at = NULL`

**Step 2: Background Job Trigger**
- Scheduled job runs every 2 minutes (or triggered by webhook if webhooks implemented)
- Queries: `SELECT * FROM email_queue WHERE classification_status = 'pending' AND deleted_at IS NULL LIMIT 50`
- Processes in batches of 50 to avoid rate limits

**Step 3: Classification Processing**
- For each email:
  1. Set `classification_status = 'processing'`
  2. Set `classification_attempted_at = NOW()`
  3. Call `classifyEmail()` from `lib/sync/classifyEmail.ts`
  4. On success: Update `category`, `classification_raw`, `classification_status = 'completed'`
  5. On error: Set `classification_status = 'failed'`, log error, retry up to 3 times with exponential backoff

**Step 4: Completion**
- Email now has `category` set
- UI can immediately filter/display by category
- No user action required

### 1.5 Avoiding Duplicate Processing

**Mechanisms:**
1. **Database-level lock:** Use `classification_status` field to prevent concurrent processing
   - Query: `UPDATE email_queue SET classification_status = 'processing' WHERE id = $1 AND classification_status = 'pending' RETURNING *`
   - If no rows returned, another worker already claimed it

2. **Idempotency:** `classifyEmail()` function is idempotent (same input = same output)
   - Can safely retry on failure

3. **Deduplication by gmail_message_id:** 
   - `email_queue` has `UNIQUE(user_id, gmail_message_id)` constraint
   - Prevents duplicate emails from being inserted

4. **Processing window:** Only process emails where `classification_status = 'pending'`
   - Once set to 'completed' or 'failed', skip

### 1.6 Threading Logic

**Current State:**
- Emails have `gmail_thread_id` stored
- UI groups by thread, but classification is per-email

**New Behavior:**
- Classification remains per-email (each email in thread classified independently)
- **Future Enhancement:** Thread-level classification could consider thread context, but not in initial implementation

**Thread Context for Drafts:**
- Chat assistant already fetches previous emails from same recipient (`app/api/sync/chat/route.ts:154-161`)
- This threading logic remains unchanged
- Classification doesn't need thread context (categories are email-level)

### 1.7 Implementation Components

**New Files:**
- `lib/sync/classifyEmailBatch.ts` - Batch classification processor
- `lib/sync/jobs/emailClassificationJob.ts` - Scheduled job runner
- `app/api/sync/jobs/classify-emails/route.ts` - Job endpoint (for cron/webhook triggers)

**Modified Files:**
- `lib/gmail/sync.ts` - Set `classification_status = 'pending'` on insert
- `lib/sync/runGmailSync.ts` - Write to `email_queue` instead of `sync_email_messages`

**Configuration:**
- `SYNC_CLASSIFICATION_BATCH_SIZE = 50` (env var)
- `SYNC_CLASSIFICATION_INTERVAL_MINUTES = 2` (env var)
- `SYNC_CLASSIFICATION_MAX_RETRIES = 3` (env var)

---

## 2. Appointment Detection

### 2.1 Overview

Automatically detect when emails contain appointment requests, meeting proposals, or scheduling intent. Extract structured date/time/location data and prepare for calendar event creation.

### 2.2 Detection Trigger

**Trigger:** After email is classified (or in parallel with classification)

**Flow:**
1. Email arrives → stored in `email_queue`
2. Classification job runs → sets `category`
3. Appointment detection job runs → analyzes email for scheduling intent
4. If appointment detected → stores structured data, flags email

### 2.3 Detection Logic

**Method:** AI-based extraction (similar to `extractAppointmentInfo()` in chat)

**Input:**
- Email subject
- Email body (text, truncated to 3000 chars)
- Email from_address (to identify sender)
- Email internal_date (to resolve relative dates like "tomorrow")

**AI Prompt:**
```
You are an appointment extraction assistant. Analyze the email and determine if it contains:
1. A request to schedule a meeting/appointment
2. A proposed meeting time/date
3. A confirmed meeting time/date
4. A calendar invitation (iCal attachment reference)

Return JSON:
{
  "hasAppointment": true/false,
  "appointmentType": "request" | "proposal" | "confirmation" | "invitation" | null,
  "appointment": {
    "title": "Meeting title or subject",
    "description": "What the meeting is about",
    "date": "YYYY-MM-DD",
    "time": "HH:MM in 24-hour format",
    "timezone": "America/New_York" (if mentioned, else null),
    "location": "location if mentioned" (optional),
    "duration_minutes": 60 (default, or extracted if mentioned),
    "attendees": ["email1@example.com", "email2@example.com"] (from email headers)
  },
  "confidence": 0.0-1.0 (how confident the extraction is)
}
```

**Model:** `gpt-4o-mini` (same as classification, cost-efficient)

**Parameters:**
- `temperature: 0.1` (low for consistency)
- `max_tokens: 500`
- `response_format: { type: "json_object" }`

### 2.4 Database Schema for Appointments

**New Table: `email_appointments`**
```sql
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
```

**Add to `email_queue` table:**
```sql
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS has_appointment BOOLEAN DEFAULT false;

ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS appointment_detected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_email_queue_has_appointment 
ON email_queue(user_id, has_appointment) 
WHERE has_appointment = true AND deleted_at IS NULL;
```

### 2.5 Processing Flow

**Step 1: Detection Job**
- Scheduled job runs every 2 minutes (after classification job)
- Queries: `SELECT * FROM email_queue WHERE has_appointment = false AND category IS NOT NULL AND deleted_at IS NULL ORDER BY internal_date DESC LIMIT 50`
- Only process emails that have been classified (to avoid processing spam)

**Step 2: AI Extraction**
- For each email, call appointment extraction AI
- Parse JSON response
- Validate date/time (must be in future, reasonable date range)

**Step 3: Storage**
- If `hasAppointment = true` and `confidence >= 0.7`:
  1. Insert into `email_appointments` table
  2. Update `email_queue.has_appointment = true`
  3. Update `email_queue.appointment_detected_at = NOW()`
  4. Optionally: Update `email_queue.category = 'important'` if appointment is high-confidence

**Step 4: UI Flagging**
- Emails with `has_appointment = true` show special badge/icon in UI
- Can filter by "Has Appointment" in email list
- Clicking email shows appointment details panel

### 2.6 Category Integration

**Existing Categories:** Use existing 7 categories, no new "Scheduling" category

**Logic:**
- If appointment detected AND `confidence >= 0.8`:
  - Set `category = 'important'` (appointments are important)
- If appointment detected AND `confidence < 0.8`:
  - Keep existing category, but flag with `has_appointment = true`

**UI Display:**
- Show appointment badge/icon regardless of category
- Category chip shows normal category (e.g., "important")
- Appointment icon indicates scheduling intent

### 2.7 Calendar Event Creation Preparation

**Data Ready for Calendar:**
- `email_appointments` table has all required fields:
  - `title`, `description`, `appointment_date`, `appointment_time`, `timezone`, `location`, `duration_minutes`, `attendees`

**Creation Trigger:**
- User can click "Add to Calendar" button in UI
- Or automatic creation if user enables "Auto-add appointments to calendar" setting

**API Flow:**
- `POST /api/sync/appointments/[id]/create-calendar-event`
- Creates event in Google Calendar via Calendar API
- Updates `email_appointments.calendar_event_id` and `status = 'calendar_created'`

### 2.8 Implementation Components

**New Files:**
- `lib/sync/detectAppointment.ts` - Appointment detection AI function
- `lib/sync/jobs/appointmentDetectionJob.ts` - Scheduled job runner
- `app/api/sync/appointments/[id]/create-calendar-event/route.ts` - Calendar event creation
- `app/api/sync/appointments/route.ts` - List appointments endpoint

**Modified Files:**
- `app/sync/page.tsx` - Show appointment badges, appointment details panel
- `lib/gmail/sync.ts` - No changes (appointment detection is separate job)

---

## 3. Reminder + Task Extraction System

### 3.1 Overview

Extract actionable tasks and reminders from emails. Store structured task data with due dates, priorities, and completion status.

### 3.2 Detection Logic

**What Constitutes a "Reminder" or "Task":**
- Explicit due dates ("due by Friday", "deadline: Jan 30")
- Action items ("please review", "need to approve", "follow up on")
- Time-sensitive requests ("urgent", "asap", "by end of week")
- Recurring obligations ("monthly report", "weekly check-in")

**Method:** AI-based extraction with structured output

**AI Prompt:**
```
You are a task and reminder extraction assistant. Analyze the email and extract:
1. Explicit tasks or action items requested
2. Due dates or deadlines mentioned
3. Priority indicators (urgent, important, asap)
4. Recurring patterns (daily, weekly, monthly)

Return JSON:
{
  "hasTasks": true/false,
  "tasks": [
    {
      "description": "Task description",
      "dueDate": "YYYY-MM-DD" (if mentioned, else null),
      "dueTime": "HH:MM" (if mentioned, else null),
      "priority": "high" | "medium" | "low" (based on urgency keywords),
      "assignee": "email@example.com" (if task assigned to someone, else null),
      "recurring": {
        "frequency": "daily" | "weekly" | "monthly" | null,
        "endDate": "YYYY-MM-DD" (if recurring has end date, else null)
      }
    }
  ],
  "reminders": [
    {
      "message": "Reminder text",
      "remindAt": "YYYY-MM-DDTHH:MM:SS" (when to remind user),
      "relatedTaskId": "task-id-if-linked" (optional)
    }
  ]
}
```

**Model:** `gpt-4o-mini`

**Parameters:**
- `temperature: 0.2` (slightly higher than classification for more natural extraction)
- `max_tokens: 1000`
- `response_format: { type: "json_object" }`

### 3.3 Database Schema

**New Table: `email_tasks`**
```sql
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
```

**New Table: `email_reminders`**
```sql
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
```

**Add to `email_queue` table:**
```sql
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS has_tasks BOOLEAN DEFAULT false;

ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS tasks_detected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_email_queue_has_tasks 
ON email_queue(user_id, has_tasks) 
WHERE has_tasks = true AND deleted_at IS NULL;
```

### 3.4 Processing Flow

**Step 1: Task Extraction Job**
- Scheduled job runs every 2 minutes (after appointment detection)
- Queries: `SELECT * FROM email_queue WHERE has_tasks = false AND category IN ('important', 'missed_unread') AND deleted_at IS NULL ORDER BY internal_date DESC LIMIT 50`
- Only process important/missed emails (to avoid extracting tasks from marketing emails)

**Step 2: AI Extraction**
- For each email, call task extraction AI
- Parse JSON response
- Validate due dates (must be reasonable, not in distant past)

**Step 3: Storage**
- If `hasTasks = true`:
  1. Insert tasks into `email_tasks` table
  2. Insert reminders into `email_reminders` table (if `remindAt` specified)
  3. Update `email_queue.has_tasks = true`
  4. Update `email_queue.tasks_detected_at = NOW()`

**Step 4: Reminder Processing**
- Separate scheduled job runs every minute
- Queries: `SELECT * FROM email_reminders WHERE status = 'pending' AND remind_at <= NOW()`
- Sends notifications (in-app, email, or push)
- Updates `status = 'sent'` and `notification_sent_at = NOW()`

### 3.5 UI Integration

**Email List:**
- Show task badge/icon for emails with `has_tasks = true`
- Filter by "Has Tasks" in email list

**Email Detail View:**
- Show "Tasks" panel below email content
- List all tasks extracted from email
- Show due dates, priorities, status
- Allow user to mark tasks as complete

**Tasks View (New Page):**
- `/sync/tasks` - Dedicated tasks page
- Shows all tasks across all emails
- Filter by status, priority, due date
- Group by email or date

**Reminders View:**
- `/sync/reminders` - Dedicated reminders page
- Shows upcoming reminders
- Allows dismissing/snoozing reminders

### 3.6 Implementation Components

**New Files:**
- `lib/sync/extractTasks.ts` - Task extraction AI function
- `lib/sync/jobs/taskExtractionJob.ts` - Scheduled job runner
- `lib/sync/jobs/reminderProcessorJob.ts` - Reminder notification job
- `app/api/sync/tasks/route.ts` - Tasks CRUD endpoints
- `app/api/sync/reminders/route.ts` - Reminders CRUD endpoints
- `app/sync/tasks/page.tsx` - Tasks UI page
- `app/sync/reminders/page.tsx` - Reminders UI page

**Modified Files:**
- `app/sync/page.tsx` - Show task badges, tasks panel

---

## 4. Draft Mode Trigger → Calendar Alert Creation

### 4.1 Overview

When user edits/generates a draft reply that contains scheduling or task intent, automatically create calendar alerts or task reminders.

### 4.2 Detection Logic

**Trigger Points:**
1. User generates draft via `/api/sync/email/draft/[id]`
2. User edits draft via chat (`/api/sync/chat` with draft update keywords)
3. User manually edits draft in UI and saves

**Detection Method:**
- After draft is generated/updated, analyze draft text for scheduling/task intent
- Use same AI extraction logic as appointment/task detection
- If intent detected, prompt user or auto-create (based on user preference)

### 4.3 Flow: Draft Update → API → Calendar → Database

**Step 1: Draft Generation/Update**
- User triggers draft generation or updates draft
- Draft text stored in `email_queue.ai_draft`

**Step 2: Intent Detection (Background)**
- After draft saved, trigger background job (or inline if fast enough)
- Analyze `ai_draft` text using appointment/task extraction AI
- Check if draft contains:
  - Appointment proposals ("Let's meet on...", "How about...")
  - Task commitments ("I'll review by...", "I'll send...")

**Step 3: User Confirmation (Optional)**
- If intent detected AND user has "Auto-create calendar events" disabled:
  - Show in-app notification: "We detected a meeting in your draft. Create calendar event?"
  - User clicks "Yes" → proceed to Step 4
- If user has "Auto-create calendar events" enabled:
  - Skip confirmation, proceed to Step 4

**Step 4: Calendar Event Creation**
- Extract appointment data from draft
- Create calendar event via Google Calendar API
- Store in `email_appointments` table (link to email)
- Update `email_appointments.calendar_event_id` and `status = 'calendar_created'`

**Step 5: Task Creation (If Task Intent)**
- Extract task data from draft
- Create task in `email_tasks` table
- Link to email via `email_id`
- If due date mentioned, create reminder in `email_reminders`

### 4.4 API Endpoints

**New Endpoints:**
- `POST /api/sync/drafts/[id]/detect-intent` - Analyze draft for intent
- `POST /api/sync/drafts/[id]/create-calendar-event` - Create calendar event from draft
- `POST /api/sync/drafts/[id]/create-task` - Create task from draft

**Modified Endpoints:**
- `GET /api/sync/email/draft/[id]` - After generating draft, optionally trigger intent detection
- `PATCH /api/sync/email/draft/[id]` - After updating draft, optionally trigger intent detection
- `POST /api/sync/chat` - After draft update, trigger intent detection

### 4.5 Conflict Handling

**Duplicate Appointments:**
- Before creating calendar event, check `email_appointments` for same email_id
- If exists and `status != 'cancelled'`, don't create duplicate
- Show user: "Calendar event already exists for this email"

**Duplicate Tasks:**
- Before creating task, check `email_tasks` for same email_id and similar description
- Use fuzzy matching (Levenshtein distance < 10) to detect duplicates
- If duplicate found, update existing task instead of creating new

**Calendar Conflicts:**
- Before creating calendar event, check Google Calendar for overlapping events
- Query Calendar API: `calendar.events.list(timeMin, timeMax)`
- If conflict detected:
  - Show user: "You have a conflicting event at this time. Still create?"
  - User confirms → create anyway
  - User cancels → don't create

### 4.6 User Preferences

**New Settings Table:**
```sql
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
```

### 4.7 Implementation Components

**New Files:**
- `lib/sync/detectDraftIntent.ts` - Analyze draft for scheduling/task intent
- `lib/sync/createCalendarFromDraft.ts` - Create calendar event from draft
- `lib/sync/createTaskFromDraft.ts` - Create task from draft
- `app/api/sync/drafts/[id]/detect-intent/route.ts` - Intent detection endpoint
- `app/api/sync/drafts/[id]/create-calendar-event/route.ts` - Calendar creation endpoint
- `app/api/sync/drafts/[id]/create-task/route.ts` - Task creation endpoint

**Modified Files:**
- `app/api/sync/email/draft/[id]/route.ts` - Trigger intent detection after draft generation
- `app/api/sync/chat/route.ts` - Trigger intent detection after draft update
- `app/sync/page.tsx` - Show "Create calendar event" / "Create task" buttons when intent detected

---

## 5. Category Filtering + UI Integration

### 5.1 Existing Categories

**7 Fixed Categories (No Changes):**
1. `important` - Personal, urgent, security alerts, account notifications, high-priority work
2. `missed_unread` - Direct messages expecting reply, may have been missed
3. `payment_bill` - Bills, charges, bank notifications, payment reminders
4. `invoice` - Invoices, receipts, payment confirmations, billing documents
5. `marketing` - Newsletters, promotional emails, marketing campaigns
6. `updates` - Product updates, service notifications, system updates
7. `other` - Everything else

### 5.2 Category Chips and Colors

**Color Scheme (Existing):**
- `important` - Red (#ef4444)
- `missed_unread` - Orange (#f97316)
- `payment_bill` - Yellow (#eab308)
- `invoice` - Blue (#3b82f6)
- `marketing` - Purple (#a855f7)
- `updates` - Green (#22c55e)
- `other` - Gray (#6b7280)

**UI Display:**
- Category chip shown on each email in list
- Chip color matches category
- Chip text shows category name (human-readable: "Important", "Missed/Unread", etc.)

### 5.3 Default "All" Filter

**Behavior:**
- "All" shows all emails where `deleted_at IS NULL`
- No category filtering applied
- Includes emails with `category = NULL` (not yet classified)

**Query:**
```sql
SELECT * FROM email_queue 
WHERE user_id = $1 
  AND deleted_at IS NULL 
ORDER BY internal_date DESC
```

### 5.4 Category Filter Logic

**Backend Query Structure:**
```sql
-- Filter by single category
SELECT * FROM email_queue 
WHERE user_id = $1 
  AND category = $2 
  AND deleted_at IS NULL 
ORDER BY internal_date DESC

-- Filter by multiple categories
SELECT * FROM email_queue 
WHERE user_id = $1 
  AND category IN ($2, $3, $4) 
  AND deleted_at IS NULL 
ORDER BY internal_date DESC

-- Filter by "Uncategorized" (NULL category)
SELECT * FROM email_queue 
WHERE user_id = $1 
  AND category IS NULL 
  AND deleted_at IS NULL 
ORDER BY internal_date DESC
```

**API Endpoint:**
- `GET /api/sync/email/queue?category=important&category=missed_unread`
- Supports multiple category filters (OR logic)
- Supports `category=null` for uncategorized

### 5.5 Additional Filters

**Combined Filters:**
- Category + Status: `?category=important&queue_status=open`
- Category + Has Appointment: `?category=important&has_appointment=true`
- Category + Has Tasks: `?category=important&has_tasks=true`
- Category + Date Range: `?category=important&from_date=2025-01-01&to_date=2025-01-31`

**Query Structure:**
```sql
SELECT * FROM email_queue 
WHERE user_id = $1 
  AND deleted_at IS NULL
  AND ($2::text IS NULL OR category = $2)
  AND ($3::text IS NULL OR queue_status = $3)
  AND ($4::boolean IS NULL OR has_appointment = $4)
  AND ($5::boolean IS NULL OR has_tasks = $5)
  AND ($6::timestamptz IS NULL OR internal_date >= $6)
  AND ($7::timestamptz IS NULL OR internal_date <= $7)
ORDER BY internal_date DESC
LIMIT $8 OFFSET $9
```

### 5.6 UI Integration

**Filter Bar:**
- Category dropdown: "All", "Important", "Missed/Unread", "Payment/Bill", "Invoice", "Marketing", "Updates", "Other", "Uncategorized"
- Status filter: "All", "Open", "Snoozed", "Done", "Archived"
- Additional filters: "Has Appointment", "Has Tasks", "Unread Only"

**Email List:**
- Each email shows category chip
- Clicking category chip filters list to that category
- Category chips are clickable filters

**Email Counts:**
- Show count per category: "Important (12)", "Missed/Unread (5)", etc.
- Update counts in real-time as emails are classified

### 5.7 Implementation Components

**Modified Files:**
- `app/api/sync/email/queue/route.ts` - Add category filtering logic
- `app/sync/page.tsx` - Add category filter UI, category chips, filter bar

**No New Files Required:**
- Category system already exists, just needs filtering UI

---

## 6. Real-Time and Performance Considerations

### 6.1 Webhooks vs Polling

**Current State:** Polling-based (scheduled jobs every 2 minutes)

**Recommendation: Hybrid Approach**

**Phase 1: Enhanced Polling (Immediate)**
- Keep scheduled jobs for reliability
- Reduce interval to 1 minute for faster processing
- Add exponential backoff for failed jobs

**Phase 2: Gmail Push Notifications (Future)**
- Implement Gmail Pub/Sub webhooks
- Requires Google Cloud Pub/Sub topic setup
- Webhook endpoint: `POST /api/sync/gmail/webhook`
- On webhook: Trigger immediate sync for that user
- Fallback to polling if webhook fails

**Phase 3: Calendar Webhooks (Future)**
- Implement Google Calendar push notifications
- Webhook endpoint: `POST /api/sync/calendar/webhook`
- On webhook: Sync calendar events for that user

**Decision Matrix:**
- **Polling:** Simple, reliable, no infrastructure changes, 1-2 minute delay
- **Webhooks:** Real-time, requires Pub/Sub setup, more complex, potential for missed events

**Recommendation:** Start with enhanced polling, add webhooks in Phase 2

### 6.2 Preventing Double-Processing

**Mechanisms:**

1. **Database-Level Locks:**
   - Use `classification_status` field with atomic updates
   - Query: `UPDATE email_queue SET classification_status = 'processing' WHERE id = $1 AND classification_status = 'pending' RETURNING *`
   - If no rows returned, another worker already claimed it

2. **Idempotency Keys:**
   - Use `gmail_message_id` as natural idempotency key
   - `UNIQUE(user_id, gmail_message_id)` constraint prevents duplicates

3. **Processing Windows:**
   - Only process emails where `classification_status = 'pending'`
   - Once set to 'completed', skip
   - Retry logic only for 'failed' status

4. **Distributed Lock (Future):**
   - Use Redis or database advisory locks for multi-instance deployments
   - Lock key: `sync:classify:email:{email_id}`
   - TTL: 5 minutes (auto-release if job crashes)

### 6.3 ML Job Queueing

**Current Approach:** Direct API calls to OpenAI (synchronous)

**Recommended Approach: Job Queue System**

**Option 1: Database Queue (Simple)**
- Use `email_queue.classification_status` as queue
- Workers poll database for pending jobs
- Pros: Simple, no new infrastructure
- Cons: Database load, polling overhead

**Option 2: Redis Queue (Scalable)**
- Use BullMQ or similar Redis-based queue
- Queue: `sync:classification`, `sync:appointments`, `sync:tasks`
- Workers process jobs from queue
- Pros: Scalable, rate limiting, retry logic built-in
- Cons: Requires Redis infrastructure

**Option 3: Hybrid (Recommended)**
- Use database for job state (`classification_status`)
- Use Redis for job queue (if Redis available)
- Fallback to database polling if Redis unavailable

**Rate Limiting:**
- OpenAI API: 500 requests/minute (check current limits)
- Batch size: 50 emails per job
- Job interval: 2 minutes
- Max concurrent jobs: 5 per user

### 6.4 Retry Logic

**Classification Retries:**
- Max retries: 3
- Backoff: Exponential (1min, 2min, 4min)
- After 3 failures: Set `classification_status = 'failed'`, log error
- Manual retry: User can trigger via UI

**Appointment Detection Retries:**
- Max retries: 2
- Backoff: Exponential (2min, 4min)
- After 2 failures: Skip appointment detection for that email

**Task Extraction Retries:**
- Max retries: 2
- Backoff: Exponential (2min, 4min)
- After 2 failures: Skip task extraction for that email

**Retry Implementation:**
```typescript
// Pseudo-code
async function processWithRetry(
  emailId: string,
  processor: () => Promise<void>,
  maxRetries: number = 3
) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      await processor();
      return; // Success
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        // Mark as failed, log error
        await markAsFailed(emailId, error);
        return;
      }
      // Exponential backoff
      await sleep(Math.pow(2, attempt) * 60 * 1000);
    }
  }
}
```

### 6.5 Performance Optimization

**Database Indexes:**
- Already exists: `idx_email_queue_user_id`, `idx_email_queue_category`
- Add: `idx_email_queue_classification_status` (for job queries)
- Add: `idx_email_queue_has_appointment` (for appointment queries)
- Add: `idx_email_queue_has_tasks` (for task queries)

**Batch Processing:**
- Process 50 emails per batch (configurable)
- Use `LIMIT 50` in job queries
- Process batches in parallel (up to 5 concurrent batches)

**Caching:**
- Classification results: Already cached in database (`category` field)
- Drafts: Already cached for 24 hours (`ai_draft` field)
- No additional caching needed

**API Rate Limiting:**
- OpenAI: 500 requests/minute (shared across all users)
- Gmail API: 250 quota units per second per user
- Calendar API: 600 requests per 100 seconds per user

**Monitoring:**
- Track job execution time
- Track API call counts
- Track error rates
- Alert on high error rates or slow processing

---

## 7. Database Schema Changes

### 7.1 Email Queue Table Additions

```sql
-- Classification status tracking
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS classification_status TEXT DEFAULT 'pending' 
  CHECK (classification_status IN ('pending', 'processing', 'completed', 'failed'));

ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS classification_attempted_at TIMESTAMPTZ;

-- Appointment detection
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS has_appointment BOOLEAN DEFAULT false;

ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS appointment_detected_at TIMESTAMPTZ;

-- Task detection
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS has_tasks BOOLEAN DEFAULT false;

ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS tasks_detected_at TIMESTAMPTZ;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_queue_classification_status 
ON email_queue(user_id, classification_status) 
WHERE classification_status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_queue_has_appointment 
ON email_queue(user_id, has_appointment) 
WHERE has_appointment = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_queue_has_tasks 
ON email_queue(user_id, has_tasks) 
WHERE has_tasks = true AND deleted_at IS NULL;
```

### 7.2 New Tables

**Email Appointments Table:**
(Already defined in Section 2.4)

**Email Tasks Table:**
(Already defined in Section 3.3)

**Email Reminders Table:**
(Already defined in Section 3.3)

**User Sync Preferences Table:**
(Already defined in Section 4.6)

### 7.3 Migration from sync_email_messages

**Migration Script:**
```sql
-- One-time migration: Copy data from sync_email_messages to email_queue
-- Deduplicate by gmail_message_id (external_id in sync_email_messages)

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
  created_at,
  updated_at
)
SELECT 
  w.owner_user_id as user_id,
  sem.external_id as gmail_message_id,
  sem.thread_id as gmail_thread_id,
  sem.labels as gmail_labels,
  sem.from_address,
  sem.to_addresses,
  sem.cc_addresses,
  sem.bcc_addresses,
  sem.subject,
  sem.snippet,
  NULL as body_html, -- sync_email_messages doesn't store body
  NULL as body_text,
  sem.internal_date,
  sem.is_read,
  sem.is_important as is_starred, -- Map is_important to is_starred
  CASE 
    WHEN 'INBOX' = ANY(sem.labels) THEN 'open'
    ELSE 'archived'
  END as queue_status,
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
```

**Post-Migration:**
- Mark `sync_email_messages` as deprecated (add comment)
- Don't delete table immediately (keep for rollback)
- Update all code to use `email_queue` only

### 7.4 Cleanup and Optimization

**Cleanup Old Data:**
```sql
-- Archive old deleted emails (older than 90 days)
UPDATE email_queue 
SET deleted_at = NOW() 
WHERE deleted_at IS NOT NULL 
  AND deleted_at < NOW() - INTERVAL '90 days'
  AND deleted_source = 'ovrsee';

-- Or permanently delete (if needed)
-- DELETE FROM email_queue 
-- WHERE deleted_at IS NOT NULL 
--   AND deleted_at < NOW() - INTERVAL '90 days';
```

**Vacuum and Analyze:**
```sql
-- Run periodically to optimize indexes
VACUUM ANALYZE email_queue;
VACUUM ANALYZE email_appointments;
VACUUM ANALYZE email_tasks;
VACUUM ANALYZE email_reminders;
```

---

## 8. Final System Diagram

### 8.1 Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           GMAIL API                                      │
│                    (OAuth2, Messages, History)                          │
└────────────────────────────┬────────────────────────────────────────────┘
                              │
                              │ (Push/Poll)
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    GMAIL SYNC LAYER                                     │
│  ┌────────────────────┐         ┌──────────────────────┐             │
│  │ initialGmailSync() │         │ incrementalGmailSync()│             │
│  │ - Fetch messages   │         │ - Fetch history       │             │
│  │ - Parse headers    │         │ - Process changes     │             │
│  │ - Extract body     │         │ - Update status       │             │
│  └─────────┬──────────┘         └──────────┬───────────┘             │
│            │                                  │                          │
│            └──────────────┬──────────────────┘                          │
│                           │                                               │
│                           ▼                                               │
│              ┌───────────────────────────┐                              │
│              │   email_queue Table       │                              │
│              │  - classification_status  │                              │
│              │  - has_appointment        │                              │
│              │  - has_tasks              │                              │
│              └───────────┬───────────────┘                              │
└───────────────────────────┼─────────────────────────────────────────────┘
                            │
                            │ (New emails with status='pending')
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE PROCESSING LAYER                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │         BACKGROUND JOB PROCESSOR (Every 2 minutes)              │   │
│  │                                                                 │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │  1. CLASSIFICATION JOB                                    │  │   │
│  │  │     - Query: status='pending'                             │  │   │
│  │  │     - Call: classifyEmail() → OpenAI                     │  │   │
│  │  │     - Update: category, classification_status='completed' │  │   │
│  │  └──────────────────────┬───────────────────────────────────┘  │   │
│  │                         │                                       │   │
│  │  ┌──────────────────────▼───────────────────────────────────┐  │   │
│  │  │  2. APPOINTMENT DETECTION JOB                             │  │   │
│  │  │     - Query: has_appointment=false, category IS NOT NULL │  │   │
│  │  │     - Call: detectAppointment() → OpenAI                  │  │   │
│  │  │     - Insert: email_appointments table                    │  │   │
│  │  │     - Update: has_appointment=true                       │  │   │
│  │  └──────────────────────┬───────────────────────────────────┘  │   │
│  │                         │                                       │   │
│  │  ┌──────────────────────▼───────────────────────────────────┐  │   │
│  │  │  3. TASK EXTRACTION JOB                                   │  │   │
│  │  │     - Query: has_tasks=false, category IN ('important')  │  │   │
│  │  │     - Call: extractTasks() → OpenAI                       │  │   │
│  │  │     - Insert: email_tasks, email_reminders tables         │  │   │
│  │  │     - Update: has_tasks=true                              │  │   │
│  │  └──────────────────────┬───────────────────────────────────┘  │   │
│  │                         │                                       │   │
│  │  ┌──────────────────────▼───────────────────────────────────┐  │   │
│  │  │  4. REMINDER PROCESSOR JOB (Every 1 minute)               │  │   │
│  │  │     - Query: email_reminders WHERE status='pending'       │  │   │
│  │  │     - Check: remind_at <= NOW()                           │  │   │
│  │  │     - Send: Notifications (in-app, email, push)            │  │   │
│  │  │     - Update: status='sent'                               │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            │ (Enriched email data)
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE LAYER                                  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ email_queue  │  │email_appoint- │  │ email_tasks  │              │
│  │              │  │    ments      │  │              │              │
│  │ - category   │  │ - date/time   │  │ - description│              │
│  │ - has_appt   │  │ - location    │  │ - due_date   │              │
│  │ - has_tasks  │  │ - attendees   │  │ - priority   │              │
│  │ - ai_draft   │  │ - status      │  │ - status     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐                                   │
│  │email_remind- │  │user_sync_    │                                   │
│  │    ers       │  │ preferences   │                                   │
│  │ - remind_at  │  │ - auto_create │                                   │
│  │ - message    │  │ - notif_method│                                   │
│  │ - status     │  └──────────────┘                                   │
│  └──────────────┘                                                      │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            │ (Query enriched data)
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                        │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ /api/sync/email/ │  │ /api/sync/       │  │ /api/sync/       │  │
│  │    queue         │  │   appointments   │  │   tasks           │  │
│  │ - List emails    │  │ - List/CRUD      │  │ - List/CRUD       │  │
│  │ - Filter by cat  │  │ - Create calendar│  │ - Mark complete   │  │
│  │ - Filter by appt │  │   event          │  │                   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ /api/sync/email/ │  │ /api/sync/chat   │  │ /api/sync/drafts │  │
│  │    draft/[id]    │  │                  │  │   /[id]/detect-  │  │
│  │ - Generate draft │  │ - Chat with AI    │  │   intent         │  │
│  │ - Edit draft     │  │ - Edit drafts    │  │ - Create calendar│  │
│  │                  │  │ - Extract appt   │  │   from draft      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            │ (Render UI)
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         UI LAYER                                        │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ /sync            │  │ /sync/tasks     │  │ /sync/reminders  │  │
│  │ - Email list     │  │ - Task list      │  │ - Reminder list   │  │
│  │ - Category chips  │  │ - Filter/status  │  │ - Upcoming        │  │
│  │ - Appointment    │  │ - Mark complete   │  │ - Dismiss/snooze │  │
│  │   badges         │  │                   │  │                   │  │
│  │ - Task badges    │  │                   │  │                   │  │
│  │ - Draft editor   │  │                   │  │                   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                            │
                            │ (User actions)
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    USER TRIGGERED ACTIONS                                │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  DRAFT MODE → CALENDAR/TASK CREATION                           │   │
│  │                                                                 │   │
│  │  1. User generates/edits draft                                  │   │
│  │  2. System detects intent (appointment/task)                  │   │
│  │  3. User confirms (or auto-creates if enabled)                │   │
│  │  4. Create calendar event or task                             │   │
│  │  5. Link to email via email_id                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CALENDAR INTEGRATION                                            │   │
│  │                                                                 │   │
│  │  - Sync Google Calendar events                                  │   │
│  │  - Create events from appointments                              │   │
│  │  - Check conflicts before creation                              │   │
│  │  - Store calendar_event_id in email_appointments                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Data Flow Summary

**Email Arrival Flow:**
1. Gmail API → Sync Layer → `email_queue` (status='pending')
2. Classification Job → OpenAI → Update category
3. Appointment Job → OpenAI → Insert `email_appointments`
4. Task Job → OpenAI → Insert `email_tasks`, `email_reminders`
5. Reminder Job → Send notifications when due

**User Interaction Flow:**
1. User views email list (filtered by category/appointment/tasks)
2. User generates/edits draft
3. System detects intent → Prompts user or auto-creates
4. Calendar event or task created → Linked to email

**Real-Time Updates:**
- Polling: Jobs run every 1-2 minutes
- Future: Webhooks trigger immediate processing

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Database schema migrations
- Consolidate to `email_queue` table
- Automatic classification pipeline
- Category filtering UI

### Phase 2: Intelligence (Week 3-4)
- Appointment detection
- Task extraction
- Reminder system
- UI badges and filters

### Phase 3: Integration (Week 5-6)
- Draft → Calendar/Task creation
- Calendar conflict detection
- User preferences
- Notification system

### Phase 4: Optimization (Week 7-8)
- Performance tuning
- Error handling improvements
- Monitoring and alerts
- Documentation

---

## Success Metrics

- **Classification Coverage:** >95% of emails classified within 5 minutes
- **Appointment Detection:** >80% accuracy for high-confidence appointments
- **Task Extraction:** >70% accuracy for actionable tasks
- **Processing Time:** <2 minutes from email arrival to intelligence applied
- **User Engagement:** >50% of users use appointment/task features

---

**End of Specification**


