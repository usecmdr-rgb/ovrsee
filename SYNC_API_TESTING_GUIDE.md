# Sync API Testing Guide

## Prerequisites

1. **Install googleapis package:**
   ```bash
   npm install googleapis
   ```

2. **Set environment variables in `.env.local`:**
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3000/api/sync/google/callback
   
   # Optional: For internal worker route protection
   INTERNAL_SYNC_SECRET=your_secret_here
   ```

3. **Start dev server:**
   ```bash
   npm run dev
   ```

4. **Get authentication cookie:**
   - Visit http://localhost:3000
   - Log in to your account
   - Open browser DevTools → Application/Storage → Cookies
   - Find the Supabase auth cookie (usually named `sb-<project-id>-auth-token`)
   - Copy the full cookie value

## Testing Flow

### Step 1: Verify Authentication

**Request:**
```http
GET http://localhost:3000/api/me
Cookie: sb-<project-id>-auth-token=<your-cookie-value>
```

**Expected Response:**
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "workspace": {
    "id": "workspace-id",
    "name": null
  },
  ...
}
```

### Step 2: Get Google OAuth URL

**Request:**
```http
GET http://localhost:3000/api/sync/google/oauth-url?returnTo=%2Fsync
Cookie: sb-<project-id>-auth-token=<your-cookie-value>
```

**Expected Response:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&state=..."
}
```

**Action:** Copy the `url` and open it in your browser to complete Google OAuth consent.

### Step 3: Complete OAuth Flow

1. Open the OAuth URL from Step 2 in your browser
2. Sign in to Google and grant permissions
3. Google will redirect to `/api/sync/google/callback`
4. You should be redirected to `/sync` (or the `returnTo` path you specified)
5. Check `public.integrations` table - you should see new rows with `provider='gmail'` and `provider='google_calendar'`

### Step 4: Start Gmail Sync Job

**Request:**
```http
POST http://localhost:3000/api/sync/gmail/start
Content-Type: application/json
Cookie: sb-<project-id>-auth-token=<your-cookie-value>

{}
```

**Expected Response:**
```json
{
  "jobId": "uuid-here",
  "status": "pending"
}
```

### Step 5: Start Calendar Sync Job

**Request:**
```http
POST http://localhost:3000/api/sync/calendar/start
Content-Type: application/json
Cookie: sb-<project-id>-auth-token=<your-cookie-value>

{}
```

**Expected Response:**
```json
{
  "jobId": "uuid-here",
  "status": "pending"
}
```

### Step 6: Process Sync Jobs

**Request:**
```http
POST http://localhost:3000/api/internal/sync/run-once
Content-Type: application/json
X-Internal-Secret: YOUR_SECRET_HERE  # Only if INTERNAL_SYNC_SECRET is set

{}
```

**Expected Response (if job found):**
```json
{
  "processed": true,
  "jobId": "uuid-here",
  "jobType": "gmail_initial",
  "status": "completed"
}
```

**Expected Response (if no pending jobs):**
```json
{
  "processed": false,
  "message": "No pending jobs found"
}
```

**Note:** You may need to call this endpoint multiple times:
- First call processes Gmail job
- Second call processes Calendar job
- Third call returns "No pending jobs found"

### Step 7: List Synced Gmail Messages

**Request:**
```http
GET http://localhost:3000/api/sync/gmail/messages?limit=20
Cookie: sb-<project-id>-auth-token=<your-cookie-value>
```

**Expected Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "externalId": "gmail-message-id",
      "threadId": "gmail-thread-id",
      "fromAddress": "sender@example.com",
      "toAddresses": ["recipient@example.com"],
      "subject": "Email subject",
      "snippet": "Email preview...",
      "internalDate": "2025-01-16T10:00:00Z",
      "labels": ["INBOX", "UNREAD"],
      "isRead": false,
      "isImportant": false,
      "createdAt": "2025-01-16T10:00:00Z",
      "updatedAt": "2025-01-16T10:00:00Z"
    }
  ],
  "count": 20
}
```

**Query Parameters:**
- `limit` (default: 50, max: 100) - Number of messages to return
- `before` - ISO date string - Only messages before this date
- `after` - ISO date string - Only messages after this date
- `query` - Search string - Searches in subject and snippet (case-insensitive)

**Example with filters:**
```http
GET http://localhost:3000/api/sync/gmail/messages?limit=10&query=important&after=2025-01-01T00:00:00Z
Cookie: sb-<project-id>-auth-token=<your-cookie-value>
```

### Step 8: List Synced Calendar Events

**Request:**
```http
GET http://localhost:3000/api/sync/calendar/events?from=2025-01-16T00:00:00Z&to=2025-01-23T23:59:59Z
Cookie: sb-<project-id>-auth-token=<your-cookie-value>
```

**Expected Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "externalId": "google-calendar-event-id",
      "calendarId": "primary",
      "summary": "Meeting with Team",
      "description": "Discuss project updates",
      "location": "Conference Room A",
      "startAt": "2025-01-16T14:00:00Z",
      "endAt": "2025-01-16T15:00:00Z",
      "status": "confirmed",
      "attendees": [
        {
          "email": "attendee@example.com",
          "displayName": "John Doe",
          "responseStatus": "accepted"
        }
      ],
      "hangoutLink": null,
      "createdAt": "2025-01-16T10:00:00Z",
      "updatedAt": "2025-01-16T10:00:00Z"
    }
  ],
  "count": 5,
  "from": "2025-01-16T00:00:00Z",
  "to": "2025-01-23T23:59:59Z"
}
```

**Query Parameters:**
- `from` (default: now) - ISO date string - Start of time range
- `to` (default: now + 7 days) - ISO date string - End of time range
- `calendarId` (optional) - Filter by specific calendar ID

## Troubleshooting

### Issue: "Unauthorized" errors

**Solution:**
- Verify your cookie is valid and not expired
- Make sure you're logged in at http://localhost:3000
- Check that the cookie name matches your Supabase project ID

### Issue: "Gmail integration not found"

**Solution:**
- Complete the OAuth flow first (Step 2-3)
- Check `public.integrations` table for rows with `provider='gmail'` and `is_active=true`
- Verify the OAuth callback completed successfully

### Issue: "No pending jobs found"

**Solution:**
- Create sync jobs first (Steps 4-5)
- Check `public.sync_jobs` table for rows with `status='pending'`
- Verify jobs were created successfully

### Issue: Sync job fails

**Solution:**
- Check `public.sync_jobs` table for `last_error` field
- Verify integration has valid `access_token`
- Check Google API quotas/limits
- Ensure `googleapis` package is installed

### Issue: "GOOGLE_CLIENT_ID is not configured"

**Solution:**
- Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env.local`
- Restart dev server after adding env vars
- Verify redirect URI matches Google Cloud Console configuration

## Database Verification

After completing the flow, verify data in Supabase:

```sql
-- Check integrations
SELECT id, workspace_id, provider, sync_status, last_synced_at, is_active
FROM public.integrations
WHERE provider IN ('gmail', 'google_calendar')
ORDER BY created_at DESC;

-- Check sync jobs
SELECT id, workspace_id, job_type, status, started_at, finished_at, last_error
FROM public.sync_jobs
ORDER BY created_at DESC;

-- Check synced messages
SELECT COUNT(*) as message_count, 
       MIN(internal_date) as oldest_message,
       MAX(internal_date) as newest_message
FROM public.sync_email_messages;

-- Check synced events
SELECT COUNT(*) as event_count,
       MIN(start_at) as earliest_event,
       MAX(start_at) as latest_event
FROM public.sync_calendar_events;
```

## Next Steps

1. **Set up cron job** to call `/api/internal/sync/run-once` periodically
2. **Implement incremental sync** (currently only initial sync is implemented)
3. **Add error retry logic** for failed jobs
4. **Add webhook handlers** for real-time sync (Gmail push notifications, Calendar webhooks)



