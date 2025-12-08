# Aloha Backend Testing Guide

This guide walks you through testing the Aloha backend before building the UI.

## Prerequisites

1. **Database migrations applied**
   - Run `supabase/migrations/20250115000000_core_aloha_schema.sql`
   - Verify tables exist: `call_logs`, `voicemail_messages`, `aloha_settings`, `integrations`

2. **Next.js dev server running**
   ```bash
   npm run dev
   ```

3. **Test user created**
   - Create a test user in Supabase Auth (or use existing)
   - Note the email address

## Step 1: Set Up Test Data

### Option A: Supabase SQL Editor (Recommended)

1. Open Supabase Dashboard → SQL Editor
2. Open `scripts/test-aloha-setup-supabase.sql`
3. Update the email and phone number:
   ```sql
   test_user_email TEXT := 'your-test-email@example.com';
   test_phone_number TEXT := '+15551234567';
   ```
4. Run the script
5. Verify with `scripts/verify-aloha-setup.sql`

### Option B: Command Line (psql)

```bash
# Update email in script first
psql $DATABASE_URL -f scripts/test-aloha-setup.sql
```

## Step 2: Test Webhooks Locally

### Test Individual Webhooks

1. **Incoming Call**:
   ```bash
   ./scripts/test-incoming-call.sh
   ```
   Expected: Creates entry in `call_logs` table

2. **Call Status Update**:
   ```bash
   # Use CallSid from step 1
   ./scripts/test-call-status.sh CA1234567890abcdef
   ```
   Expected: Updates `call_logs` with status and duration

3. **Voicemail Recorded**:
   ```bash
   # Use CallSid from step 1
   ./scripts/test-voicemail-recorded.sh CA1234567890abcdef
   ```
   Expected: Creates entry in `voicemail_messages` table

### Test Complete Flow

Run all webhooks in sequence:
```bash
./scripts/test-all-webhooks.sh
```

This simulates a complete call → voicemail flow.

## Step 3: Verify Database State

Run these queries in Supabase SQL Editor:

### Check Call Logs
```sql
SELECT 
  id,
  twilio_call_sid,
  from_number,
  to_number,
  status,
  duration_seconds,
  has_voicemail,
  started_at,
  ended_at
FROM call_logs
ORDER BY started_at DESC
LIMIT 10;
```

### Check Voicemail Messages
```sql
SELECT 
  id,
  call_log_id,
  twilio_recording_sid,
  recording_url,
  from_number,
  to_number,
  created_at
FROM voicemail_messages
ORDER BY created_at DESC
LIMIT 10;
```

### Check Linkage
```sql
SELECT 
  cl.id as call_id,
  cl.twilio_call_sid,
  cl.status as call_status,
  cl.has_voicemail,
  cl.duration_seconds,
  vm.id as voicemail_id,
  vm.recording_url,
  vm.recording_duration_seconds
FROM call_logs cl
LEFT JOIN voicemail_messages vm ON vm.call_log_id = cl.id
ORDER BY cl.started_at DESC
LIMIT 10;
```

## Step 4: Test API Endpoints

### Test GET /api/me

```bash
# Get auth token first (from Supabase dashboard or your auth flow)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/me
```

Expected response includes:
```json
{
  "aloha": {
    "has_phone_number": true,
    "phone_number": "+15551234567",
    "voicemail_enabled": true,
    "settings_configured": true,
    "ai_enabled": true
  }
}
```

### Test GET /api/aloha/calls

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/aloha/calls
```

Expected: List of call logs with pagination

### Test GET /api/aloha/calls/:id

```bash
# Use call ID from previous response
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/aloha/calls/CALL_ID
```

Expected: Detailed call info with voicemail data

## Troubleshooting

### Webhook Returns 404
- ✅ Check Next.js server is running on correct port
- ✅ Verify endpoint path: `/api/aloha/webhooks/incoming-call`
- ✅ Check BASE_URL environment variable

### Phone Number Not Found
- ✅ Run test setup script
- ✅ Verify phone number in `user_phone_numbers` table
- ✅ Check `is_active = TRUE`
- ✅ Verify `workspace_id` matches

### Call Log Not Created
- ✅ Check server logs for errors
- ✅ Verify workspace_id exists
- ✅ Check RLS policies allow operation
- ✅ Verify phone number lookup works

### Voicemail Not Created
- ✅ Check call_log exists first
- ✅ Verify call_log_id matches
- ✅ Check RLS policies
- ✅ Verify webhook parameters (RecordingSid, RecordingUrl)

## Next Steps

Once all tests pass:

1. ✅ Backend is verified and working
2. ⏳ Build frontend UI components
3. ⏳ Connect to real Twilio for end-to-end testing
4. ⏳ Add transcription and AI summarization

## Success Criteria

- ✅ Test data created (workspace, phone number, settings)
- ✅ Incoming call webhook creates call_log
- ✅ Call status webhook updates call_log
- ✅ Voicemail webhook creates voicemail_messages
- ✅ GET /api/me returns Aloha info
- ✅ GET /api/aloha/calls returns call list
- ✅ GET /api/aloha/calls/:id returns call detail

If all criteria pass, the backend slice is ready! 🎉




