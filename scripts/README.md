# Aloha Webhook Test Scripts

These scripts help test the Aloha webhook endpoints locally before connecting to real Twilio.

## Prerequisites

1. **Set up test data** in your database:
   ```sql
   -- Run in Supabase SQL Editor
   -- Update the email in scripts/test-aloha-setup.sql first
   \i scripts/test-aloha-setup.sql
   ```

2. **Start your Next.js dev server**:
   ```bash
   npm run dev
   ```

3. **Set environment variables** (optional, defaults to localhost:3000):
   ```bash
   export BASE_URL="http://localhost:3000"
   export FROM_NUMBER="+15559876543"  # Test caller number
   export TO_NUMBER="+15551234567"    # Your test Aloha number
   ```

## Usage

### Test Individual Webhooks

1. **Test incoming call**:
   ```bash
   ./scripts/test-incoming-call.sh
   ```
   This creates a `call_logs` entry.

2. **Test call status update**:
   ```bash
   ./scripts/test-call-status.sh <CallSid>
   ```
   Updates the call_log with status and duration.

3. **Test voicemail recorded**:
   ```bash
   ./scripts/test-voicemail-recorded.sh <CallSid>
   ```
   Creates a `voicemail_messages` entry.

### Test Complete Flow

Run all webhooks in sequence:
```bash
./scripts/test-all-webhooks.sh
```

This simulates:
1. Incoming call → creates call_log
2. Call completed → updates call_log
3. Voicemail recorded → creates voicemail_messages

## Verification

After running the tests, verify in your database:

```sql
-- Check call logs
SELECT 
  id,
  twilio_call_sid,
  from_number,
  to_number,
  status,
  duration_seconds,
  has_voicemail,
  started_at
FROM call_logs
ORDER BY started_at DESC
LIMIT 10;

-- Check voicemail messages
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

-- Check linkage
SELECT 
  cl.id as call_id,
  cl.twilio_call_sid,
  cl.status as call_status,
  cl.has_voicemail,
  vm.id as voicemail_id,
  vm.recording_url
FROM call_logs cl
LEFT JOIN voicemail_messages vm ON vm.call_log_id = cl.id
ORDER BY cl.started_at DESC
LIMIT 10;
```

## Troubleshooting

### Scripts not executable
```bash
chmod +x scripts/test-*.sh
```

### Webhook returns 404
- Check that your Next.js server is running
- Verify the endpoint path: `/api/aloha/webhooks/incoming-call`
- Check BASE_URL environment variable

### Phone number not found
- Run `scripts/test-aloha-setup.sql` to create test data
- Update TO_NUMBER in the script to match your test phone number
- Verify the phone number exists in `user_phone_numbers` table

### Call log not created
- Check server logs for errors
- Verify workspace_id and user_id are correct
- Check RLS policies allow the operation




