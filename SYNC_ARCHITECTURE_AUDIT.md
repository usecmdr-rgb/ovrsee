# OVRSEE Sync Feature - Comprehensive Architecture Audit

**Date:** January 2025  
**Auditor:** Senior Architect Review  
**Scope:** Full Sync feature analysis (Gmail sync, email processing, AI integration, calendar/reminders)

---

## 1. Current Data Flow

### Gmail → Backend → Database → Sync UI

#### **Step 1: Gmail Connection & OAuth**
- **Location:** `lib/sync/integrations.ts`, `app/api/sync/google/callback/route.ts`
- **Process:**
  1. User initiates Gmail OAuth via `/api/sync/google/oauth-url`
  2. OAuth callback stores tokens in `integrations` table (provider: "gmail")
  3. Tokens stored: `access_token`, `refresh_token`, `token_expires_at`, `scopes`
  4. Integration metadata includes user's Google email address
  5. Workspace-based: Each user has a workspace, integrations are workspace-scoped

#### **Step 2: Initial Sync**
- **Location:** `lib/gmail/sync.ts` → `initialGmailSync()`, `lib/sync/runGmailSync.ts` → `runGmailInitialSync()`
- **Process:**
  1. User triggers sync via `/api/sync/gmail/start` (creates `sync_jobs` entry)
  2. Sync worker fetches messages from Gmail API:
     - Uses `gmail.users.messages.list()` with query: `in:inbox after:{dateThreshold}`
     - Default: 30 days back, max 500 messages (configurable)
     - Fetches full message details via `gmail.users.messages.get(format: "full")`
  3. **Two parallel implementations exist:**
     - **Legacy:** `lib/gmail/sync.ts` → stores in `email_queue` table
     - **New:** `lib/sync/runGmailSync.ts` → stores in `sync_email_messages` table
  4. Message parsing extracts:
     - Headers: From, To, Cc, Bcc, Subject, Date
     - Body: HTML and plain text (decoded from base64url)
     - Labels: Gmail labelIds (INBOX, UNREAD, STARRED, etc.)
     - Metadata: `gmail_message_id`, `gmail_thread_id`, `gmail_history_id`, `internal_date`

#### **Step 3: Incremental Sync**
- **Location:** `lib/gmail/sync.ts` → `incrementalGmailSync()`
- **Process:**
  1. Retrieves last `history_id` from integration metadata
  2. Calls `gmail.users.history.list(startHistoryId)` to get changes since last sync
  3. Processes three types of history entries:
     - **messagesAdded:** New emails → upsert to `email_queue`
     - **labelsAdded/labelsRemoved:** Updates read/unread/archive status
     - **messagesDeleted:** Soft-deletes emails (sets `deleted_at`)
  4. Updates `last_history_id` in integration metadata

#### **Step 4: Database Storage**
- **Primary Table:** `email_queue` (legacy) and `sync_email_messages` (new)
- **Schema (`email_queue`):**
  - Gmail mapping: `gmail_message_id`, `gmail_thread_id`, `gmail_history_id`, `gmail_labels[]`
  - Email content: `from_address`, `from_name`, `to_addresses[]`, `cc_addresses[]`, `bcc_addresses[]`, `subject`, `snippet`, `body_html`, `body_text`, `internal_date`
  - Queue state: `queue_status` (open/snoozed/done/archived), `is_read`, `is_starred`
  - Classification: `category` (important/missed_unread/payment_bill/invoice/marketing/updates/other), `classification_raw` (JSONB)
  - AI drafts: `ai_draft`, `ai_draft_generated_at`, `ai_draft_model`
  - Soft delete: `deleted_at`, `deleted_by`, `deleted_source`
  - Metadata: `metadata` (JSONB), `snoozed_until`
- **Indexes:** user_id, user_id+queue_status, gmail_thread_id, internal_date DESC, category, snoozed_until

#### **Step 5: Sync UI**
- **Location:** `app/sync/page.tsx`, `components/sync/SyncIntelligence.tsx`
- **Process:**
  1. Frontend queries `/api/sync/email/queue` to fetch emails
  2. Filters by `queue_status`, `category`, `is_read`, date ranges
  3. Displays email list with categories, draft status, actions
  4. User can: view email, generate/edit drafts, send replies, archive, snooze

---

## 2. Current Email Parsing & Classification

### **Email Parsing (Gmail API → Structured Data)**
- **Location:** `lib/gmail/client.ts` → `parseEmailHeaders()`, `extractEmailBody()`
- **Extracted Metadata:**
  - **Headers:** From (name + email), To, Cc, Bcc, Subject, Date
  - **Body:** HTML and plain text (extracted from multipart MIME, base64url decoded)
  - **Gmail Labels:** Array of labelIds (INBOX, UNREAD, STARRED, IMPORTANT, etc.)
  - **Threading:** `gmail_thread_id` for conversation grouping
  - **Timestamps:** `internal_date` (Gmail's internal timestamp)

### **Email Classification**
- **Location:** `lib/sync/classifyEmail.ts`, `app/api/sync/email/categorize/route.ts`
- **Method:** OpenAI GPT-4o-mini with JSON mode
- **Categories (7 fixed):**
  1. **important:** Personal, urgent, security alerts, account notifications, high-priority work
  2. **missed_unread:** Direct messages expecting reply, may have been missed
  3. **payment_bill:** Bills, charges, bank notifications, payment reminders, financial updates
  4. **invoice:** Invoices, receipts, payment confirmations, billing documents
  5. **marketing:** Newsletters, promotional emails, marketing campaigns
  6. **updates:** Product updates, service notifications, system updates, feature announcements
  7. **other:** Everything else

- **Classification Process:**
  1. **On-demand:** User triggers via `/api/sync/email/categorize` (batch up to 50 emails)
  2. **Input:** `from_address`, `subject`, `body_text` (truncated to 2000 chars)
  3. **AI Prompt:** System prompt defines categories, user prompt includes email content
  4. **Output:** JSON with `category` field, stored in `email_queue.category` and `classification_raw`
  5. **Fallback:** On error, defaults to "other"

- **Simple Rule-Based Classification (Legacy):**
  - **Location:** `lib/gmail/sync.ts` → `determineCategory()`
  - **Method:** String matching on subject + snippet (lowercase)
  - **Rules:**
    - "payment|invoice|bill|payout|stripe|paypal" → "payments"
    - "invoice|billing" → "invoices"
    - "urgent|important|asap|deadline" → "important"
    - "meeting|calendar|appointment" → "meetings"
    - "subscription|renewal" → "subscriptions"
  - **Status:** Still used during sync, but AI classification is preferred

### **What is NOT Currently Extracted:**
- ❌ Email intent (request, question, complaint, etc.)
- ❌ Named entities (people, companies, dates, amounts)
- ❌ Sentiment analysis
- ❌ Priority scoring (beyond category)
- ❌ Action items or tasks mentioned in email
- ❌ Appointment/meeting details (dates, times, locations) - only basic keyword detection
- ❌ Attachments metadata (not stored, only email body)

---

## 3. Current AI Usage

### **OpenAI Integration**
- **Location:** `lib/openai.ts`
- **Model:** Uses `OPENAI_API_KEY` environment variable
- **Client:** OpenAI SDK (`openai` package)

### **AI Usage Points:**

#### **1. Email Classification**
- **Function:** `lib/sync/classifyEmail.ts` → `classifyEmail()`
- **Model:** `gpt-4o-mini`
- **Prompt:**
  - System: Defines 7 categories with descriptions
  - User: `From: {address}\nSubject: {subject}\nBody: {bodyText}`
- **Output:** JSON `{category: "important" | "missed_unread" | ...}`
- **Parameters:** `temperature: 0.1`, `max_tokens: 50`, `response_format: {type: "json_object"}`
- **Caching:** None - called on-demand per email

#### **2. Email Draft Generation**
- **Function:** `lib/sync/generateDraft.ts` → `generateEmailDraft()`
- **Model:** `gpt-4o-mini`
- **Prompt:**
  - System: Instructions to generate professional, concise draft replies (2-4 sentences)
  - User: Includes sender info, subject, body, and business context (name, services, location, hours)
- **Output:** Plain text draft reply (with signature appended)
- **Parameters:** `temperature: 0.7`, `max_tokens: 500`
- **Caching:** Drafts stored in `email_queue.ai_draft`, cached for 24 hours
- **API Endpoint:** `GET /api/sync/email/draft/[id]` (generates or returns cached)
- **Signature:** Auto-appends user name and business name from business context

#### **3. Sync Chat Assistant**
- **Function:** `app/api/sync/chat/route.ts`
- **Model:** `gpt-4o-mini`
- **Prompt:**
  - System: Defines Sync as email/calendar assistant, understands commands, extracts appointments
  - User: Includes current email context, previous emails from same recipient, business context
- **Capabilities:**
  - Answer questions about current email
  - Edit drafts ("make it more professional", "add a thank you")
  - Extract appointments from conversation (date, time, title, description, location)
  - Update drafts based on user requests
- **Output:** Natural language response + optional JSON appointment data
- **Parameters:** `temperature: 0.7`, `max_tokens: 500`

#### **4. Appointment Extraction (Sub-function)**
- **Function:** `app/api/sync/chat/route.ts` → `extractAppointmentInfo()`
- **Model:** `gpt-4o-mini`
- **Prompt:**
  - System: Extracts appointments, meetings, scheduled events from text
  - User: Text to analyze + email context
- **Output:** JSON `{hasAppointment: boolean, appointment: {title, description, date, time, location?}}`
- **Parameters:** `temperature: 0.1`, `response_format: {type: "json_object"}`

#### **5. Draft Update (Sub-function)**
- **Function:** `app/api/sync/chat/route.ts` (inline)
- **Model:** `gpt-4o-mini`
- **Prompt:**
  - System: Professional email draft editor
  - User: Current draft + user request + email context
- **Output:** Updated draft text
- **Parameters:** `temperature: 0.7`, `max_tokens: 500`

### **AI Usage Summary:**
- **Total AI Functions:** 5 distinct uses
- **Models Used:** `gpt-4o-mini` (all)
- **Cost Optimization:** Using mini model for cost efficiency
- **Caching:** Only drafts are cached (24 hours)
- **Error Handling:** All functions have fallback defaults on error

### **What AI Does NOT Currently Do:**
- ❌ Automatic classification on email arrival (only on-demand)
- ❌ Automatic draft generation on email arrival
- ❌ Intent recognition (request, question, complaint, etc.)
- ❌ Task extraction from email body
- ❌ Automatic reminder creation
- ❌ Smart prioritization scoring
- ❌ Thread summarization
- ❌ Attachment analysis

---

## 4. Calendar / Reminder / Appointment Logic

### **Calendar Sync**
- **Location:** `lib/sync/runCalendarSync.ts` → `runCalendarInitialSync()`
- **Process:**
  1. Fetches events from Google Calendar API (`calendar.events.list()`)
  2. Time range: Now → +30 days
  3. Stores in `sync_calendar_events` table:
     - `external_id` (Calendar event ID)
     - `summary`, `description`, `location`
     - `start_at`, `end_at` (timestamps)
     - `status` (confirmed/tentative/cancelled)
     - `attendees` (array with email, displayName, responseStatus)
     - `hangout_link`
  4. Updates `last_synced_at` on integration

### **Appointment Extraction from Emails**
- **Location:** `app/api/sync/chat/route.ts` → `extractAppointmentInfo()`
- **Method:** AI extraction via GPT-4o-mini
- **Trigger:** User mentions appointment in chat conversation
- **Output:** Structured appointment data (title, description, date, time, location)
- **Calendar Creation:** 
  - If appointment detected, creates calendar event via `/api/calendar/events/create`
  - Stores memo with email context (sender, subject, description)

### **What Exists:**
- ✅ Calendar sync (reads events from Google Calendar)
- ✅ Appointment extraction from chat conversations
- ✅ Calendar event creation from extracted appointments
- ✅ Calendar events stored in `sync_calendar_events` table

### **What is Stubbed or Planned:**
- ⚠️ **Calendar conflict detection:** Code comment says "Would check calendar for conflicts" (`app/api/beta/brief/route.ts:40`)
- ⚠️ **Calendar issues:** Empty array returned (`app/api/beta/brief/route.ts:184`)

### **What is Missing:**
- ❌ **Automatic appointment detection from emails:** Only works via chat, not on email arrival
- ❌ **Reminder creation:** No automatic reminders for emails or appointments
- ❌ **Calendar alerts:** No automatic calendar alert creation for upcoming events
- ❌ **Email-to-calendar linking:** No bidirectional link between emails and calendar events
- ❌ **Recurring appointment detection:** Not handled
- ❌ **Time zone handling:** Basic (uses business context timezone or defaults to America/New_York)
- ❌ **Calendar webhooks:** No push notifications for calendar changes
- ❌ **Smart scheduling:** No conflict detection, no suggested times
- ❌ **Reminder system:** No database table or logic for reminders

---

## 5. Opportunities for Improvement

### **Gaps Preventing Intelligent Features:**

#### **A. Email Intent Recognition**
- **Current State:** No intent classification (request, question, complaint, information, etc.)
- **Blockers:**
  - No intent field in database schema
  - No AI prompt for intent extraction
  - Classification only categorizes by type, not intent
- **Impact:** Cannot automatically prioritize emails that need responses vs. informational

#### **B. Appointment Detection**
- **Current State:** Only works via chat conversation, not automatic on email arrival
- **Blockers:**
  - No automatic appointment extraction during email sync
  - No scheduled job to scan emails for appointments
  - No database field to store extracted appointment data
- **Impact:** Users must manually chat to extract appointments; missed opportunities for automatic calendar creation

#### **C. Automatic Reminders**
- **Current State:** No reminder system exists
- **Blockers:**
  - No `reminders` table in database
  - No scheduled job to check for reminder triggers
  - No logic to create reminders from emails or appointments
- **Impact:** Cannot automatically remind users about important emails, deadlines, or appointments

#### **D. Task Extraction**
- **Current State:** No task extraction from emails
- **Blockers:**
  - No `tasks` table linked to emails
  - No AI prompt for task extraction
  - No integration with task management systems
- **Impact:** Cannot automatically create tasks from action items mentioned in emails

#### **E. Draft-Mode Triggers**
- **Current State:** Drafts only generated on-demand (user clicks "Generate Draft")
- **Blockers:**
  - No automatic draft generation on email arrival
  - No rules engine to determine when to auto-generate drafts
  - No webhook/trigger system for new emails
- **Impact:** Users must manually request drafts; no proactive assistance

#### **F. Calendar Alert Creation**
- **Current State:** Calendar events created, but no alerts/reminders
- **Blockers:**
  - No reminder/alert system for calendar events
  - No integration between calendar events and email reminders
  - No notification system (push, email, in-app)
- **Impact:** Users may miss important calendar events

#### **G. Additional Gaps:**
- **No webhook/push notifications:** Sync is pull-based (scheduled jobs), not real-time
- **No email threading intelligence:** Basic thread grouping, no conversation summarization
- **No attachment processing:** Attachments not stored or analyzed
- **No sender reputation:** No tracking of sender importance or relationship
- **No smart snoozing:** Snooze is manual, no AI-suggested snooze times
- **No email summarization:** Full email body stored, no summaries for quick scanning
- **No multi-email context:** Draft generation doesn't consider thread history (only in chat)

---

## 6. Risks / Complexity Notes

### **Architectural Risks:**

#### **1. Dual Database Tables**
- **Risk:** Two parallel implementations:
  - `email_queue` (legacy, used by `lib/gmail/sync.ts`)
  - `sync_email_messages` (new, used by `lib/sync/runGmailSync.ts`)
- **Impact:** Data inconsistency, confusion about which table is source of truth
- **Complexity:** Migration path unclear, both may be in use simultaneously

#### **2. Dual Integration Systems**
- **Risk:** Two ways to store Gmail connections:
  - `gmail_connections` table (legacy, referenced in some code)
  - `integrations` table (new, workspace-based)
- **Impact:** Token refresh logic may break, sync may fail if wrong table used
- **Complexity:** `lib/gmail/client.ts` still references `gmail_connections` in error handling

#### **3. No Real-Time Sync**
- **Risk:** Sync is pull-based (scheduled jobs or manual triggers)
- **Impact:** Delays in email visibility, no instant notifications
- **Complexity:** Gmail supports push notifications via Pub/Sub, but not implemented

#### **4. Token Refresh Fragility**
- **Risk:** Token refresh logic in `lib/gmail/client.ts` has fallback to `gmail_connections` table
- **Impact:** May fail silently or use wrong credentials
- **Complexity:** Mixed code paths for token management

#### **5. Classification Not Automatic**
- **Risk:** Classification only happens on-demand via API
- **Impact:** New emails arrive unclassified, requires user action
- **Complexity:** No background job to classify emails automatically

#### **6. No Error Recovery**
- **Risk:** If sync fails mid-batch, partial data may be stored
- **Impact:** Inconsistent state, some emails synced, others not
- **Complexity:** No transaction rollback, no retry logic for failed messages

#### **7. Draft Generation Cost**
- **Risk:** Drafts generated on-demand, no rate limiting
- **Impact:** High OpenAI API costs if many users generate drafts simultaneously
- **Complexity:** 24-hour cache helps, but no per-user rate limiting

#### **8. Calendar Sync Limited**
- **Risk:** Only syncs primary calendar, next 30 days
- **Impact:** Misses secondary calendars, past events, events beyond 30 days
- **Complexity:** No incremental calendar sync (only initial)

#### **9. No Webhook Infrastructure**
- **Risk:** No Gmail push notifications, no calendar webhooks
- **Impact:** Must poll for changes, higher API usage, delays
- **Complexity:** Requires Pub/Sub setup for Gmail, webhook endpoints for Calendar

#### **10. Business Context Dependency**
- **Risk:** Draft generation and chat rely on `getBusinessContext()`
- **Impact:** If business context missing, drafts may be generic
- **Complexity:** No fallback to user profile if business context unavailable

### **Data Integrity Risks:**
- **Soft deletes:** `deleted_at` field used, but no cleanup job for old deleted emails
- **Metadata field:** `metadata` JSONB field exists but not consistently used
- **Classification raw:** `classification_raw` stored but not used for debugging/improvement

---

## 7. Final Summary

### **What Sync CAN Currently Do:**

1. **Gmail Integration:**
   - ✅ Connect Gmail via OAuth
   - ✅ Initial sync (last 30 days, configurable)
   - ✅ Incremental sync (via Gmail history API)
   - ✅ Store emails in database with full content (HTML + text)
   - ✅ Track Gmail labels (read/unread, starred, archived)
   - ✅ Sync email metadata (from, to, cc, bcc, subject, date)

2. **Email Management:**
   - ✅ View emails in queue UI
   - ✅ Filter by status (open/snoozed/done/archived)
   - ✅ Filter by category (7 categories)
   - ✅ Mark as read/unread, star, archive
   - ✅ Snooze emails (with `snoozed_until` timestamp)
   - ✅ Soft delete emails

3. **AI Classification:**
   - ✅ Classify emails into 7 categories (on-demand)
   - ✅ Store classification results in database
   - ✅ Fallback to "other" on error

4. **AI Draft Generation:**
   - ✅ Generate draft replies using OpenAI
   - ✅ Include business context in drafts
   - ✅ Auto-append email signature
   - ✅ Cache drafts for 24 hours
   - ✅ Edit drafts via chat interface

5. **Chat Assistant:**
   - ✅ Answer questions about emails
   - ✅ Edit drafts via natural language
   - ✅ Extract appointments from conversation
   - ✅ Create calendar events from extracted appointments

6. **Calendar Sync:**
   - ✅ Sync Google Calendar events (next 30 days)
   - ✅ Store events in database
   - ✅ Track attendees, location, status

### **What Sync CANNOT Currently Do:**

1. **Automatic Intelligence:**
   - ❌ Auto-classify emails on arrival
   - ❌ Auto-generate drafts on arrival
   - ❌ Auto-detect appointments in emails
   - ❌ Auto-create reminders
   - ❌ Auto-extract tasks from emails

2. **Real-Time Updates:**
   - ❌ No push notifications for new emails
   - ❌ No webhook infrastructure
   - ❌ Sync is pull-based only

3. **Advanced Features:**
   - ❌ No intent recognition (request, question, complaint)
   - ❌ No task extraction or management
   - ❌ No reminder system
   - ❌ No email summarization
   - ❌ No thread intelligence (beyond basic grouping)
   - ❌ No attachment processing
   - ❌ No sender reputation tracking

4. **Calendar Intelligence:**
   - ❌ No automatic appointment detection from emails
   - ❌ No calendar conflict detection
   - ❌ No reminder alerts for calendar events
   - ❌ No smart scheduling suggestions
   - ❌ No recurring appointment handling

5. **Automation:**
   - ❌ No workflow automation (workflows exist in UI but not executed)
   - ❌ No rules engine for auto-actions
   - ❌ No scheduled jobs for background processing

### **Key Architectural Decisions Needed:**

1. **Consolidate database tables:** Choose `email_queue` or `sync_email_messages`, migrate data
2. **Consolidate integration storage:** Fully migrate from `gmail_connections` to `integrations`
3. **Implement webhooks:** Add Gmail Pub/Sub and Calendar webhooks for real-time updates
4. **Add background jobs:** Scheduled jobs for auto-classification, auto-draft generation, appointment detection
5. **Build reminder system:** Database schema + scheduled jobs for reminder triggers
6. **Add task extraction:** Database schema + AI prompts for task extraction
7. **Implement intent recognition:** Add intent field + AI classification

### **Recommended Next Steps:**

1. **High Priority:**
   - Consolidate to single email table (`email_queue` recommended)
   - Add automatic classification on email arrival
   - Implement webhook infrastructure for real-time sync
   - Add automatic appointment detection from emails

2. **Medium Priority:**
   - Build reminder system (database + jobs)
   - Add task extraction from emails
   - Implement intent recognition
   - Add email summarization

3. **Low Priority:**
   - Add attachment processing
   - Implement sender reputation
   - Add thread summarization
   - Build workflow automation engine

---

**End of Audit**


