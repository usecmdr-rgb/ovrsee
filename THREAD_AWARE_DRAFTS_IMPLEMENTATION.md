# Thread-Aware Draft Generation Implementation

## Summary

Implemented thread-aware draft generation for Sync's AI, allowing draft replies to automatically use prior emails in the same thread for context.

## Changes Made

### 1. New Module: Thread Context Retrieval

**File:** `lib/sync/getThreadContext.ts`

**Function:** `getThreadContext(userId, threadId, currentEmailId, limit?)`

**Features:**
- Fetches all emails in a thread from `email_queue` table
- Orders messages chronologically (oldest first)
- Excludes current email being replied to
- Handles long threads (>10 messages):
  - Summarizes older messages using AI
  - Includes last 5 messages verbatim
- Fetches intent metadata (appointments, tasks, reminders) from related tables
- Truncates long email bodies (max 2000 chars)
- Gracefully handles errors (returns empty context)

**Thread Summarization:**
- Uses `gpt-4o-mini` for cost efficiency
- Generates 2-3 sentence factual summaries
- Focuses on: key topics, commitments, dates/deadlines, decisions

### 2. Updated Draft Generation

**File:** `lib/sync/generateDraft.ts`

**Changes:**
- Added optional parameters: `emailId` and `threadId`
- Checks feature flag: `THREAD_CONTEXT_FOR_DRAFTS_ENABLED`
- Fetches thread context when enabled and threadId available
- Uses thread-aware system prompt when context is available
- Includes thread context in user prompt:
  - Thread summary (if long thread)
  - Recent messages (formatted as conversation)
  - Intent metadata (appointments, tasks, reminders)

**System Prompts:**
- `SYSTEM_PROMPT_BASE`: Original prompt (used when no thread context)
- `SYSTEM_PROMPT_WITH_THREAD`: Enhanced prompt with thread awareness instructions

**Prompt Instructions Added:**
- Read and respect prior context
- Be consistent with previous commitments
- Maintain continuity in scheduling discussions
- Acknowledge tasks/deadlines when appropriate
- Avoid hallucinating unsupported facts
- Reference prior messages when clarifying (but not excessively)

### 3. Updated API Endpoints

**File:** `app/api/sync/email/draft/[id]/route.ts`

**Changes:**
- Fetches `gmail_thread_id` from email
- Passes `emailId` and `threadId` to `generateEmailDraft()`

**File:** `app/api/sync/chat/route.ts`

**Changes:**
- Fetches `gmail_thread_id` from current email
- Includes thread context when updating drafts via chat
- Uses dynamic import for thread context functions

### 4. Feature Flag

**File:** `lib/sync/featureFlags.ts`

**New Function:** `isThreadContextForDraftsEnabled()`

**Environment Variable:** `THREAD_CONTEXT_FOR_DRAFTS_ENABLED`

**Behavior:**
- When `false` or unset: Uses original draft generation (no thread context)
- When `true`: Uses thread-aware draft generation

### 5. Test Files

**Files:**
- `lib/sync/__tests__/getThreadContext.test.ts` - Thread context retrieval tests
- `lib/sync/__tests__/generateDraft.test.ts` - Draft generation with thread context tests

**Note:** Tests follow existing project patterns (conceptual tests, can be expanded with proper mocking)

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# Enable thread-aware draft generation
THREAD_CONTEXT_FOR_DRAFTS_ENABLED=true
```

### Default Behavior

- **Disabled by default** - Set `THREAD_CONTEXT_FOR_DRAFTS_ENABLED=true` to enable
- When disabled, draft generation works exactly as before (no thread context)
- When enabled, thread context is automatically included when available

## How It Works

### Flow Diagram

```
User requests draft
    ↓
Check feature flag enabled?
    ↓ Yes
Check threadId available?
    ↓ Yes
Fetch thread context
    ├─ Get all emails in thread
    ├─ If >10 messages: Summarize older, include last 5
    ├─ Fetch appointments/tasks/reminders
    └─ Format for AI prompt
    ↓
Generate draft with thread context
    ├─ Use thread-aware system prompt
    ├─ Include thread summary + recent messages
    ├─ Include intent metadata
    └─ Generate contextually-aware reply
    ↓
Return draft
```

### Thread Context Structure

```typescript
{
  threadSummary?: string;           // AI summary for long threads
  recentMessages: Array<{           // Last 5 messages (or all if <10)
    id: string;
    sender: string;
    subject: string;
    bodyText: string;
    sentAt: string;
    isFromUser: boolean;
  }>;
  intentMetadata?: {                // Appointments, tasks, reminders
    appointments: [...];
    tasks: [...];
    reminders: [...];
  };
  totalMessages: number;
}
```

## Token Management

### Limits Applied

- **Email body truncation:** 3000 chars (existing)
- **Thread message body:** 2000 chars per message
- **Thread summary:** Max 200 tokens (AI-generated)
- **Recent messages:** Last 5 messages only (for long threads)
- **Total prompt size:** Managed by including only essential context

### Summarization

- **Trigger:** Threads with >10 messages
- **Model:** `gpt-4o-mini` (cost-efficient)
- **Output:** 2-3 sentence factual summary
- **Caching:** Not implemented (can be added if needed)

## Edge Cases Handled

1. **No thread_id:** Returns empty context, generates draft without thread
2. **Single email in thread:** Returns empty context (no prior messages)
3. **Missing email data:** Uses available fields, continues gracefully
4. **Thread context fetch fails:** Logs error, generates draft without thread context
5. **Summarization fails:** Falls back to including all messages (if small) or recent only
6. **Intent metadata fetch fails:** Continues without metadata, doesn't break draft generation

## Integration Points

### Existing Systems Used

- **Email storage:** `email_queue` table (canonical)
- **Appointment data:** `email_appointments` table
- **Task data:** `email_tasks` table
- **Reminder data:** `email_reminders` table
- **Business context:** `getBusinessContext()` (existing)
- **OpenAI:** Same model (`gpt-4o-mini`) and client

### No Breaking Changes

- All changes are backward compatible
- Feature flag controls enablement
- Existing draft generation still works when flag is off
- API signatures extended (optional parameters)

## Verification Checklist

### Enable Feature

1. Set environment variable:
   ```bash
   THREAD_CONTEXT_FOR_DRAFTS_ENABLED=true
   ```

2. Restart application/server

### Test Thread-Aware Drafts

1. **Setup:**
   - Ensure you have emails in a thread (same `gmail_thread_id`)
   - At least 2-3 emails in the thread
   - One email should have an appointment or task detected

2. **Generate Draft:**
   - Open Sync UI (`/sync`)
   - Select an email that is part of a multi-message thread
   - Click "Generate Draft" or use draft generation feature
   - Check the generated draft

3. **Verify Thread Context Usage:**
   - Draft should reference previous conversation
   - Draft should be consistent with prior commitments mentioned
   - Draft should acknowledge appointments/tasks if mentioned in thread
   - Draft should not repeat information already covered

4. **Test Long Threads:**
   - Use a thread with >10 messages
   - Verify draft still generates (summarization should kick in)
   - Check that draft references key points from thread summary

5. **Test Feature Flag Off:**
   - Set `THREAD_CONTEXT_FOR_DRAFTS_ENABLED=false`
   - Generate draft for same email
   - Verify draft is generated (but without thread context)
   - Draft should be based only on current email

6. **Test Edge Cases:**
   - Single email (no thread): Should work normally
   - Missing thread_id: Should work without thread context
   - Database error: Should fall back gracefully

### Manual Verification Steps

1. **Check Logs:**
   ```bash
   # Look for thread context logs
   grep "GetThreadContext" logs
   grep "Thread context" logs
   ```

2. **Check Database:**
   ```sql
   -- Verify thread_id is populated
   SELECT id, subject, gmail_thread_id 
   FROM email_queue 
   WHERE user_id = 'your-user-id' 
   LIMIT 10;
   ```

3. **Test API Directly:**
   ```bash
   # Generate draft with thread context
   curl -X GET "http://localhost:3000/api/sync/email/draft/EMAIL_ID" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Files Modified

### New Files
- `lib/sync/getThreadContext.ts` - Thread context retrieval
- `lib/sync/__tests__/getThreadContext.test.ts` - Tests
- `lib/sync/__tests__/generateDraft.test.ts` - Tests
- `THREAD_AWARE_DRAFTS_IMPLEMENTATION.md` - This document

### Modified Files
- `lib/sync/generateDraft.ts` - Added thread context support
- `lib/sync/featureFlags.ts` - Added thread context flag
- `app/api/sync/email/draft/[id]/route.ts` - Pass threadId to generator
- `app/api/sync/chat/route.ts` - Include thread context in draft updates

## Performance Considerations

### Token Usage

- **Without thread context:** ~500-1000 tokens per draft
- **With thread context (short thread):** ~1500-2500 tokens per draft
- **With thread context (long thread):** ~2000-3000 tokens per draft (summary reduces older messages)

### Database Queries

- **Thread fetch:** 1 query (with joins for intent metadata)
- **Intent metadata:** 3 queries (appointments, tasks, reminders)
- **Total:** ~4 queries per draft generation (when thread context enabled)

### Caching Opportunities

- Thread summaries could be cached (not implemented yet)
- Intent metadata could be cached per thread (not implemented yet)

## Future Enhancements

1. **Caching:** Cache thread summaries to reduce AI calls
2. **Smart Truncation:** Keep most relevant parts of long emails (not just beginning)
3. **Thread Analysis:** Detect conversation topics/threads for better context
4. **User Preferences:** Allow users to control thread context depth
5. **Performance:** Optimize database queries with better indexes

## Troubleshooting

### Drafts not using thread context

1. Check feature flag: `THREAD_CONTEXT_FOR_DRAFTS_ENABLED=true`
2. Verify email has `gmail_thread_id` populated
3. Check logs for errors in `getThreadContext()`
4. Verify thread has other emails (not just current one)

### Drafts are too long or token-heavy

1. Check thread size - long threads are summarized
2. Verify body truncation is working (2000 chars per message)
3. Consider reducing `MAX_RECENT_MESSAGES` if needed

### Summarization not working

1. Check OpenAI API key is set
2. Verify thread has >10 messages (threshold)
3. Check logs for summarization errors
4. System falls back to including all messages if summarization fails

---

**Implementation Complete**

All thread-aware draft generation features are implemented and ready for testing.


