# Sync Email Queue Audit - AI Draft Generation

## Executive Summary

This document provides a comprehensive audit of the Sync email queue system to enable AI-powered draft reply generation. The system currently uses placeholder text for drafts and needs to be upgraded to generate real draft replies using LLM integration.

---

## 1. Email Queue Data Model

### Tables

The system uses **two separate tables** for email storage:

#### A. `email_queue` (Primary table used by `/sync` page)
**Location:** `supabase/migrations/20241213000000_email_queue.sql`

**Schema:**
```sql
CREATE TABLE email_queue (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Gmail mapping
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  gmail_history_id TEXT,
  gmail_labels TEXT[],
  
  -- Email content
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses TEXT[],
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  subject TEXT NOT NULL,
  snippet TEXT,
  body_html TEXT,              -- ✅ Full HTML body stored
  body_text TEXT,               -- ✅ Full text body stored
  internal_date TIMESTAMPTZ NOT NULL,
  
  -- Queue state
  queue_status TEXT DEFAULT 'open',
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  category_id TEXT,
  snoozed_until TIMESTAMPTZ,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  deleted_source TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, gmail_message_id)
);
```

**Key Fields:**
- ✅ **Gmail message ID:** `gmail_message_id`
- ✅ **Subject:** `subject`
- ✅ **Snippet/preview:** `snippet`
- ✅ **Full body text:** `body_text` and `body_html`
- ✅ **Labels:** `gmail_labels` (array)
- ❌ **Draft field:** **NOT PRESENT** - No `ai_draft`, `reply_draft`, or `suggested_reply` field exists

#### B. `sync_email_messages` (Newer workspace-based table)
**Location:** `supabase/migrations/20250116000000_sync_schema.sql`

**Schema:**
```sql
CREATE TABLE sync_email_messages (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  integration_id UUID,
  external_id TEXT NOT NULL,
  thread_id TEXT,
  from_address TEXT,
  to_addresses TEXT[],
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  subject TEXT,
  snippet TEXT,
  internal_date TIMESTAMPTZ,
  labels TEXT[],
  is_read BOOLEAN DEFAULT FALSE,
  is_important BOOLEAN DEFAULT FALSE,
  raw_headers JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (integration_id, external_id)
);
```

**Note:** This table does NOT store full email body (`body_html`/`body_text`), only `snippet`. It's used by some API routes but **NOT by the `/sync` page frontend**.

### Current Usage

- **Frontend (`/sync` page):** Uses `email_queue` table via `/api/email-queue` route
- **Gmail sync:** Writes to `email_queue` table with full body content
- **Draft storage:** **No draft field exists in either table**

---

## 2. Gmail Ingestion Pipeline

### Code Location

**Main sync service:** `lib/gmail/sync.ts`

### Key Functions

#### A. Initial Sync
```typescript
// Function: initialGmailSync()
// Location: lib/gmail/sync.ts:28-190

// Fetches messages using Gmail API
const message = await getGmailMessage(userId, msgRef.id, "full");  // ✅ Uses "full" format

// Parses and stores full body
const parsed = await parseGmailMessage(message);
// Returns: { bodyHtml, bodyText, subject, snippet, etc. }

// Upserts to email_queue
await supabase.from("email_queue").upsert({
  body_html: parsed.bodyHtml,    // ✅ Full HTML stored
  body_text: parsed.bodyText,     // ✅ Full text stored
  snippet: message.snippet,
  // ... other fields
});
```

#### B. Incremental Sync
```typescript
// Function: incrementalGmailSync()
// Location: lib/gmail/sync.ts:195-387

// Uses Gmail History API for changes
const historyResponse = await getGmailHistory(userId, lastHistoryId, 100);

// For new messages, fetches full format
const message = await getGmailMessage(userId, added.message.id, "full");
```

### Gmail API Format

**Format used:** `"full"` ✅
- **Location:** `lib/gmail/client.ts:247-262`
- **Function:** `getGmailMessage(userId, messageId, format: "full")`
- **Result:** Full message with complete `body_html` and `body_text` stored in `email_queue`

### Email Body Storage

✅ **Full email body IS stored:**
- `email_queue.body_html` - Complete HTML body
- `email_queue.body_text` - Complete plain text body
- Both are populated during sync from Gmail API `"full"` format

### Filtering Logic

**Location:** `lib/gmail/sync.ts:421-470`

Emails are filtered into the queue based on:
- Gmail labels (INBOX, UNREAD, etc.)
- Queue status (`open`, `snoozed`, `done`, `archived`)
- Category detection (payments, invoices, important, etc.) - based on subject/snippet keywords

---

## 3. Sync API Routes

### Primary Route: `/api/email-queue`

**Location:** `app/api/email-queue/route.ts`

**GET Endpoint:**
```typescript
GET /api/email-queue?status=open&includeDeleted=false

// Returns:
{
  emails: EmailQueueItem[],
  count: number
}
```

**Response Shape:**
```typescript
interface EmailQueueItem {
  id: string;
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  from_address: string;
  from_name?: string;
  to_addresses: string[];
  subject: string;
  snippet?: string;
  body_html?: string;      // ✅ Full body available
  body_text?: string;       // ✅ Full body available
  internal_date: string;
  queue_status: "open" | "snoozed" | "done" | "archived";
  is_read: boolean;
  is_starred: boolean;
  category_id?: string;
  gmail_labels: string[];
  // ... other fields
  // ❌ NO draft field
}
```

### Other Routes (Not used by `/sync` page)

- `/api/sync/email/queue` - Uses `sync_email_messages` table (different schema)
- `/api/sync/gmail/messages` - Uses `sync_email_messages` table
- `/api/sync/email/message/[id]` - Uses `sync_email_messages` table

**Note:** The `/sync` page frontend uses `/api/email-queue` which queries `email_queue` table.

### Placeholder Text Location

**Translation key:** `syncPlaceholderDraft`
**Location:** `lib/translations/index.ts:332`
```typescript
syncPlaceholderDraft: "Placeholder draft goes here."
```

**Usage in frontend:**
**Location:** `app/sync/page.tsx:1888`
```typescript
{getEmailDraft(selectedEmail) || t("syncPlaceholderDraft")}
```

**Current `getEmailDraft` function:**
**Location:** `app/sync/page.tsx:1259-1263`
```typescript
const getEmailDraft = (email: EmailRecord | GmailEmail | EmailQueueItem | null): string => {
  if (!email) return "";
  if ("draft" in email) return email.draft || "";
  return "";  // ❌ Always returns empty, falls back to placeholder
};
```

**Conclusion:** The placeholder is **hardcoded in the frontend** as a fallback when no draft exists. The draft field doesn't exist on `EmailQueueItem`, so it always falls back to the placeholder.

---

## 4. Existing AI / LLM Integration

### OpenAI Integration

**Location:** `lib/openai.ts`
```typescript
import OpenAI from "openai";

export const openai = new Proxy({} as OpenAI, {
  get(target, prop) {
    return getOpenAI()[prop as keyof OpenAI];
  },
});
```

**Environment variable:** `OPENAI_API_KEY`

### Existing LLM Usage

#### A. Brain API Route (Aloha Agent)
**Location:** `app/api/brain/route.ts`

**Purpose:** Handles chat completions for Aloha voice agent
- Uses OpenAI Chat Completions API
- Has system prompts for different agents
- Processes conversation context
- **Not used for email drafts**

**Function signature:**
```typescript
export async function POST(request: NextRequest) {
  // Handles chat completions for voice agent
  // Uses openai.chat.completions.create()
}
```

#### B. Insight Generator
**Location:** `app/api/insight/insights/route.ts` (referenced but not shown in search)

**Purpose:** Generates business insights from agent data

### No Existing Email Draft Function

❌ **No function exists for:**
- `generateEmailDraft()`
- `createReply()`
- `generateDraftReply()`

---

## 5. Proposed Integration Point for AI Drafts

### Recommended Approach: On-Demand API Route

**Rationale:**
1. **Cost efficiency:** Only generate drafts when user views an email
2. **Fresh context:** Can use latest email content and user preferences
3. **User control:** User can request regeneration
4. **Scalability:** Avoids pre-generating drafts for all emails

### Proposed Implementation

#### Step 1: Add Draft Field to Database

**Migration file:** `supabase/migrations/[timestamp]_add_draft_to_email_queue.sql`
```sql
ALTER TABLE email_queue 
ADD COLUMN ai_draft TEXT,
ADD COLUMN ai_draft_generated_at TIMESTAMPTZ,
ADD COLUMN ai_draft_model TEXT;  -- Track which model generated it
```

#### Step 2: Create Draft Generation API Route

**New file:** `app/api/sync/email/draft/[id]/route.ts`

```typescript
/**
 * GET /api/sync/email/draft/:id
 * Generate or retrieve AI draft reply for an email
 */
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  // 1. Authenticate user
  // 2. Fetch email from email_queue (with full body)
  // 3. Check if draft exists and is recent (< 24 hours)
  // 4. If not, generate new draft using OpenAI
  // 5. Save draft to email_queue.ai_draft
  // 6. Return draft
}
```

**Function signature:**
```typescript
async function generateDraftReply({
  userId,
  messageId,
  emailContent: {
    subject,
    bodyText,
    bodyHtml,
    fromAddress,
    fromName,
    snippet
  }
}): Promise<string>
```

#### Step 3: Draft Generation Function

**New file:** `lib/sync/generateDraft.ts`

```typescript
import { openai } from "@/lib/openai";
import { getBusinessContext } from "@/lib/business-context";

export async function generateEmailDraft(
  userId: string,
  emailContent: {
    subject: string;
    bodyText?: string;
    bodyHtml?: string;
    fromAddress: string;
    fromName?: string;
    snippet?: string;
  }
): Promise<string> {
  // Get business context for personalization
  const businessContext = await getBusinessContext(userId);
  
  // Build prompt
  const prompt = buildDraftPrompt(emailContent, businessContext);
  
  // Call OpenAI
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",  // or gpt-4o for better quality
    messages: [
      {
        role: "system",
        content: "You are OVRSEE Sync, an AI assistant that helps draft professional email replies..."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 500,
  });
  
  return response.choices[0].message.content || "";
}
```

#### Step 4: Update Email Queue API

**Modify:** `app/api/email-queue/route.ts`

Add optional `includeDraft` parameter:
```typescript
GET /api/email-queue?includeDraft=true

// Response includes:
{
  emails: [
    {
      ...EmailQueueItem,
      ai_draft?: string,  // ✅ Draft included if exists
      ai_draft_generated_at?: string
    }
  ]
}
```

### Alternative: Background Job (Not Recommended)

**Pros:**
- Pre-generates drafts for faster UI
- Can batch process

**Cons:**
- Higher API costs (generates for all emails)
- Stale drafts if email content changes
- More complex infrastructure needed

**Recommendation:** Start with on-demand, add background job later if needed.

---

## 6. Frontend Wiring for Draft Preview

### Current Components

#### A. Email Queue List
**Location:** `app/sync/page.tsx:1818-1843`
```typescript
{filteredEmails.map((email) => (
  <button onClick={() => handleEmailSelect(email)}>
    {/* Email list item */}
  </button>
))}
```

#### B. Draft Preview Panel
**Location:** `app/sync/page.tsx:1875-1940`
```typescript
<div className="rounded-3xl border ...">
  <h2>{t("syncDraftPreview")}</h2>
  {selectedEmail ? (
    <div>
      {/* Original email */}
      <p>{getEmailSnippet(selectedEmail)}</p>
      
      {/* Draft preview */}
      <p>{getEmailDraft(selectedEmail) || t("syncPlaceholderDraft")}</p>
      
      {/* Accept/Edit buttons */}
    </div>
  ) : (
    <p>{t("syncSelectEmailToPreview")}</p>
  )}
</div>
```

### Current Data Loading

**Email loading:**
**Location:** `app/sync/page.tsx:931-1007`
```typescript
const loadGmailEmails = async () => {
  const res = await fetch("/api/email-queue?status=open&includeDeleted=false");
  const data = await res.json();
  setEmailQueueItems(data.emails);
};
```

**Email selection:**
**Location:** `app/sync/page.tsx:1200-1250` (approximate)
```typescript
const handleEmailSelect = (email: EmailRecord | GmailEmail | EmailQueueItem) => {
  setSelectedEmail(email);
};
```

### Proposed Changes

#### Step 1: Update `getEmailDraft` Function

**Modify:** `app/sync/page.tsx:1259-1263`

```typescript
const getEmailDraft = (email: EmailRecord | GmailEmail | EmailQueueItem | null): string => {
  if (!email) return "";
  
  // Check if email has ai_draft field (from API response)
  if ("ai_draft" in email && email.ai_draft) {
    return email.ai_draft;
  }
  
  // Fallback to legacy draft field (for mock data)
  if ("draft" in email) return email.draft || "";
  
  return "";
};
```

#### Step 2: Add Draft Loading State

**Add state:**
```typescript
const [draftLoading, setDraftLoading] = useState<Record<string, boolean>>({});
const [draftError, setDraftError] = useState<Record<string, string>>({});
```

#### Step 3: Fetch Draft on Email Selection

**Modify:** `handleEmailSelect` function

```typescript
const handleEmailSelect = async (email: EmailRecord | GmailEmail | EmailQueueItem) => {
  setSelectedEmail(email);
  
  // If email doesn't have draft, fetch it
  if (!("ai_draft" in email) || !email.ai_draft) {
    const emailId = email.id;
    setDraftLoading(prev => ({ ...prev, [emailId]: true }));
    
    try {
      const res = await fetch(`/api/sync/email/draft/${emailId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (res.ok) {
        const data = await res.json();
        // Update email with draft
        setEmailQueueItems(prev => 
          prev.map(e => e.id === emailId ? { ...e, ai_draft: data.draft } : e)
        );
        setSelectedEmail({ ...email, ai_draft: data.draft });
      }
    } catch (error) {
      setDraftError(prev => ({ ...prev, [emailId]: "Failed to generate draft" }));
    } finally {
      setDraftLoading(prev => ({ ...prev, [emailId]: false }));
    }
  }
};
```

#### Step 4: Update Draft Preview UI

**Modify:** `app/sync/page.tsx:1885-1889`

```typescript
<div>
  <p className="text-xs uppercase tracking-wide text-slate-500">{t("syncDraft")}</p>
  {draftLoading[selectedEmail.id] ? (
    <div className="mt-1 rounded-2xl bg-slate-900/90 p-3 text-sm text-white">
      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
      Generating draft...
    </div>
  ) : draftError[selectedEmail.id] ? (
    <div className="mt-1 rounded-2xl bg-red-900/90 p-3 text-sm text-white">
      {draftError[selectedEmail.id]}
      <button onClick={() => handleEmailSelect(selectedEmail)}>
        Retry
      </button>
    </div>
  ) : (
    <p className="mt-1 rounded-2xl bg-slate-900/90 p-3 text-sm text-white">
      {getEmailDraft(selectedEmail) || t("syncPlaceholderDraft")}
    </p>
  )}
</div>
```

#### Step 5: Update Email Queue API Response

**Modify:** `app/api/email-queue/route.ts:84-87`

```typescript
// Include draft if requested
const includeDraft = searchParams.get("includeDraft") === "true";

let query = supabase
  .from("email_queue")
  .select(includeDraft ? "*, ai_draft, ai_draft_generated_at" : "*")
  // ... rest of query
```

---

## Implementation Plan Summary

### Phase 1: Database Schema
1. ✅ Create migration to add `ai_draft`, `ai_draft_generated_at`, `ai_draft_model` to `email_queue` table
2. ✅ Run migration

### Phase 2: Backend - Draft Generation
1. ✅ Create `lib/sync/generateDraft.ts` with `generateEmailDraft()` function
2. ✅ Create `app/api/sync/email/draft/[id]/route.ts` API route
3. ✅ Integrate with business context for personalization
4. ✅ Add error handling and rate limiting

### Phase 3: Backend - API Updates
1. ✅ Update `/api/email-queue` to optionally include draft field
2. ✅ Add caching logic (don't regenerate if draft < 24 hours old)

### Phase 4: Frontend - Draft Loading
1. ✅ Update `getEmailDraft()` to check `ai_draft` field
2. ✅ Add loading state management
3. ✅ Update `handleEmailSelect()` to fetch draft if missing
4. ✅ Update draft preview UI with loading/error states

### Phase 5: Testing & Polish
1. ✅ Test draft generation for various email types
2. ✅ Test error handling (API failures, rate limits)
3. ✅ Optimize prompt for quality drafts
4. ✅ Add "Regenerate draft" button

---

## File Reference Summary

### Database
- `supabase/migrations/20241213000000_email_queue.sql` - Email queue table schema
- `supabase/migrations/20250116000000_sync_schema.sql` - Alternative sync_email_messages table

### Backend
- `lib/gmail/sync.ts` - Gmail sync service (stores full body)
- `lib/gmail/client.ts` - Gmail API client (uses "full" format)
- `app/api/email-queue/route.ts` - Email queue API (used by frontend)
- `app/api/brain/route.ts` - Existing LLM integration example
- `lib/openai.ts` - OpenAI client setup

### Frontend
- `app/sync/page.tsx` - Main sync page with email queue UI
- `lib/translations/index.ts` - Placeholder text translation

### Types
- `app/sync/page.tsx:50-78` - `EmailQueueItem` interface definition

---

## Key Findings

1. ✅ **Full email body IS stored** in `email_queue.body_text` and `email_queue.body_html`
2. ❌ **No draft field exists** in database - needs to be added
3. ✅ **Gmail API uses "full" format** - complete email content available
4. ✅ **OpenAI integration exists** - can be reused for draft generation
5. ✅ **Frontend is ready** - just needs draft data and loading states
6. ⚠️ **Two table systems** - `/sync` page uses `email_queue`, some APIs use `sync_email_messages`

---

## Next Steps

1. Create database migration for draft fields
2. Implement draft generation function with OpenAI
3. Create API route for on-demand draft generation
4. Update frontend to fetch and display drafts
5. Test end-to-end flow


