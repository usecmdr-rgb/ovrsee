# Thread-Aware Drafts - Verification Guide

## Quick Start

1. **Enable the feature:**
   ```bash
   # Add to .env.local
   THREAD_CONTEXT_FOR_DRAFTS_ENABLED=true
   ```

2. **Restart your development server**

3. **Test with a multi-email thread**

## Step-by-Step Verification

### Test 1: Basic Thread Context

**Setup:**
- Find or create an email thread with at least 2-3 messages
- Ensure emails have the same `gmail_thread_id`

**Steps:**
1. Open Sync UI (`/sync`)
2. Select an email that is part of a thread
3. Click "Generate Draft" (or use the draft generation button)
4. **Verify:** Draft should reference previous conversation context

**Expected Result:**
- Draft mentions previous messages or topics
- Draft is consistent with prior commitments
- Draft doesn't repeat information unnecessarily

### Test 2: Long Thread Summarization

**Setup:**
- Use a thread with >10 messages (if available)

**Steps:**
1. Select an email from a long thread
2. Generate draft
3. **Verify:** Draft still generates successfully
4. Check logs for summarization calls

**Expected Result:**
- Draft generates without errors
- System summarizes older messages
- Last 5 messages included verbatim

### Test 3: Intent Metadata Integration

**Setup:**
- Use a thread where appointments or tasks were detected

**Steps:**
1. Select an email from a thread with detected appointments/tasks
2. Generate draft
3. **Verify:** Draft acknowledges or references appointments/tasks

**Expected Result:**
- Draft mentions scheduled meetings if relevant
- Draft references tasks or deadlines if mentioned in thread
- Draft maintains continuity with scheduling discussions

### Test 4: Feature Flag Off

**Steps:**
1. Set `THREAD_CONTEXT_FOR_DRAFTS_ENABLED=false`
2. Restart server
3. Generate draft for same email as Test 1
4. **Verify:** Draft generates but without thread context

**Expected Result:**
- Draft generates successfully
- Draft is based only on current email (no thread references)
- Behavior matches original draft generation

### Test 5: Edge Cases

**Test 5a: Single Email (No Thread)**
- Select an email with no other messages in thread
- Generate draft
- **Expected:** Draft generates normally (no thread context)

**Test 5b: Missing thread_id**
- Select an email where `gmail_thread_id` is NULL
- Generate draft
- **Expected:** Draft generates without thread context (graceful fallback)

**Test 5c: Database Error Simulation**
- Temporarily break database connection
- Generate draft
- **Expected:** Draft still generates (falls back to no thread context)

### Test 6: Chat-Based Draft Updates

**Steps:**
1. Open an email with existing draft
2. Use chat to update draft: "make it more professional"
3. **Verify:** Updated draft considers thread context

**Expected Result:**
- Draft update includes thread context if available
- Updated draft maintains thread continuity

## Verification Checklist

- [ ] Feature flag can be toggled on/off
- [ ] Drafts use thread context when enabled and threadId available
- [ ] Drafts work normally when feature is disabled
- [ ] Long threads are summarized (>10 messages)
- [ ] Short threads include all messages (≤10 messages)
- [ ] Intent metadata (appointments/tasks) is included in context
- [ ] Edge cases handled gracefully (no thread, missing data, errors)
- [ ] No breaking changes to existing draft generation
- [ ] API endpoints work with thread context
- [ ] Chat-based draft updates use thread context

## Debugging

### Check Thread Context is Being Fetched

```typescript
// Add logging in getThreadContext.ts
console.log("[GetThreadContext] Fetching thread:", threadId);
console.log("[GetThreadContext] Found messages:", threadEmails.length);
```

### Check Feature Flag Status

```typescript
// In generateDraft.ts
console.log("[GenerateDraft] Thread context enabled:", isThreadContextForDraftsEnabled());
console.log("[GenerateDraft] Thread ID:", threadId);
```

### Verify Database Data

```sql
-- Check thread_id is populated
SELECT id, subject, gmail_thread_id, 
       (SELECT COUNT(*) FROM email_queue eq2 
        WHERE eq2.gmail_thread_id = email_queue.gmail_thread_id 
        AND eq2.user_id = email_queue.user_id) as thread_size
FROM email_queue 
WHERE user_id = 'your-user-id'
ORDER BY internal_date DESC
LIMIT 10;

-- Check for appointments in thread
SELECT ea.*, eq.subject, eq.gmail_thread_id
FROM email_appointments ea
JOIN email_queue eq ON ea.email_id = eq.id
WHERE eq.gmail_thread_id = 'your-thread-id';
```

## Common Issues

### Issue: Drafts don't reference thread

**Possible Causes:**
1. Feature flag not enabled
2. `gmail_thread_id` is NULL
3. Thread has only one email
4. Thread context fetch failed (check logs)

**Solution:**
- Verify `THREAD_CONTEXT_FOR_DRAFTS_ENABLED=true`
- Check email has `gmail_thread_id` populated
- Verify thread has multiple emails
- Check error logs

### Issue: Drafts are too generic

**Possible Causes:**
1. Thread context not being included in prompt
2. Thread summary is too brief
3. Recent messages don't have enough context

**Solution:**
- Check logs to verify thread context is fetched
- Verify thread summary is being generated for long threads
- Check that recent messages include relevant content

### Issue: Token limits exceeded

**Possible Causes:**
1. Very long thread with many messages
2. Email bodies are very long
3. Too many messages included

**Solution:**
- Verify body truncation is working (2000 chars)
- Check that summarization triggers for >10 messages
- Consider reducing `MAX_RECENT_MESSAGES` if needed

---

**Ready for Testing**

All implementation is complete. Follow the verification steps above to test the feature.


