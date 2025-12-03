# Twilio End-to-End Setup Guide

This guide walks you through connecting real Twilio for end-to-end testing.

## Prerequisites

1. **Twilio Account**
   - Sign up at https://www.twilio.com/try-twilio
   - Get your Account SID, Auth Token, or API Key/Secret
   - Verify your account (for production numbers)

2. **Environment Variables**
   ```bash
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_API_SECRET=your_api_secret_here
   # OR use Auth Token:
   # TWILIO_AUTH_TOKEN=your_auth_token_here
   ```

3. **Public URL for Webhooks**
   - Development: Use ngrok or similar tunnel
   - Production: Your deployed domain (e.g., `https://ovrsee.ai`)

## Step 1: Purchase a Twilio Phone Number

### Option A: Via Twilio Console

1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/search
2. Search for a number (US, Canada, etc.)
3. Purchase the number
4. Note the Phone Number SID (starts with `PN...`)

### Option B: Via API (Recommended)

Use the purchase endpoint after implementing it, or use this script:

```bash
# scripts/purchase-twilio-number.sh
curl -X POST https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  --data-urlencode "PhoneNumber=+15551234567" \
  --data-urlencode "VoiceUrl=https://your-domain.com/api/aloha/webhooks/incoming-call" \
  --data-urlencode "StatusCallback=https://your-domain.com/api/aloha/webhooks/call-status" \
  --data-urlencode "StatusCallbackEvent=initiated ringing answered completed" \
  --data-urlencode "StatusCallbackMethod=POST"
```

## Step 2: Store Phone Number in Database

Run this SQL in Supabase (update values):

```sql
-- Replace with your actual values
INSERT INTO user_phone_numbers (
  workspace_id,
  user_id,
  phone_number,
  twilio_phone_sid,
  is_active,
  voicemail_enabled
)
VALUES (
  'your-workspace-id',
  'your-user-id',
  '+15551234567',
  'PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  TRUE,
  TRUE
);
```

Or use the API endpoint:
```bash
POST /api/telephony/twilio/purchase-number
{
  "phoneNumber": "+15551234567"
}
```

## Step 3: Configure Webhook URLs

### Option A: Via Twilio Console

1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click on your phone number
3. Scroll to "Voice & Fax" section
4. Set:
   - **A CALL COMES IN**: `https://your-domain.com/api/aloha/webhooks/incoming-call`
   - **STATUS CALLBACK URL**: `https://your-domain.com/api/aloha/webhooks/call-status`
   - **STATUS CALLBACK EVENTS**: Select all (initiated, ringing, answered, completed)
   - **HTTP METHOD**: POST

5. For Recording (if using voicemail):
   - Go to "Recordings" section
   - Set **RECORDING STATUS CALLBACK URL**: `https://your-domain.com/api/aloha/webhooks/voicemail-recorded`
   - Set **RECORDING STATUS CALLBACK METHOD**: POST

### Option B: Via API

Use the configure-webhooks endpoint:

```bash
POST /api/aloha/configure-webhooks
Authorization: Bearer YOUR_TOKEN
{
  "phoneNumberId": "uuid-of-phone-number"
}
```

Or use Twilio API directly:

```bash
curl -X POST \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers/PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  --data-urlencode "VoiceUrl=https://your-domain.com/api/aloha/webhooks/incoming-call" \
  --data-urlencode "StatusCallback=https://your-domain.com/api/aloha/webhooks/call-status" \
  --data-urlencode "StatusCallbackEvent=initiated ringing answered completed" \
  --data-urlencode "StatusCallbackMethod=POST"
```

## Step 4: Test with Real Call

### Make a Test Call

1. Call your Twilio number from any phone
2. Check your Next.js server logs for webhook requests
3. Verify in database:

```sql
-- Check call_logs
SELECT * FROM call_logs 
WHERE to_number = '+15551234567'
ORDER BY started_at DESC
LIMIT 5;

-- Check voicemail_messages (if voicemail was left)
SELECT * FROM voicemail_messages
ORDER BY created_at DESC
LIMIT 5;
```

### Expected Flow

1. **Incoming Call** → `POST /api/aloha/webhooks/incoming-call`
   - Creates `call_logs` entry
   - Returns TwiML to route to Aloha stream

2. **Call Status Updates** → `POST /api/aloha/webhooks/call-status`
   - Updates `call_logs` with status, duration

3. **Voicemail Recorded** → `POST /api/aloha/webhooks/voicemail-recorded`
   - Creates `voicemail_messages` entry
   - Links to `call_logs`

## Step 5: Development Setup (ngrok)

For local development, use ngrok to expose your local server:

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000

# Use the HTTPS URL (e.g., https://abc123.ngrok.io) in Twilio webhooks
```

Update webhook URLs to use ngrok URL:
- `https://abc123.ngrok.io/api/aloha/webhooks/incoming-call`
- `https://abc123.ngrok.io/api/aloha/webhooks/call-status`
- `https://abc123.ngrok.io/api/aloha/webhooks/voicemail-recorded`

## Troubleshooting

### Webhooks Not Receiving

1. **Check Twilio Console Logs**
   - Go to Monitor → Logs → Calls
   - Check for webhook delivery errors

2. **Verify Webhook URLs**
   - Must be HTTPS (not HTTP) for production
   - Must be publicly accessible
   - Check for typos in URLs

3. **Check Server Logs**
   - Look for incoming webhook requests
   - Check for errors in webhook handlers

4. **Test Webhook Manually**
   ```bash
   ./scripts/test-incoming-call.sh
   ```

### Call Logs Not Created

1. **Verify Phone Number in Database**
   ```sql
   SELECT * FROM user_phone_numbers 
   WHERE phone_number = '+15551234567' 
   AND is_active = TRUE;
   ```

2. **Check Workspace ID**
   - Phone number must have correct `workspace_id`
   - User must own the workspace

3. **Check RLS Policies**
   - Verify Row Level Security allows the operation

### Voicemail Not Recorded

1. **Enable Recording in TwiML**
   - Check that your TwiML includes `<Record>` verb
   - Or configure recording in Twilio Console

2. **Check Recording Status Callback**
   - Verify webhook URL is set in Twilio
   - Check that recording completes successfully

## Security Considerations

1. **Webhook Validation**
   - Twilio signs webhooks with X-Twilio-Signature header
   - Validate signatures to prevent spoofing (TODO: implement)

2. **Environment Variables**
   - Never commit Twilio credentials to git
   - Use environment variables or secrets management

3. **Rate Limiting**
   - Webhook endpoints should have rate limiting
   - Consider IP allowlisting for production

## Next Steps

Once webhooks are working:

1. ✅ Test incoming calls create call_logs
2. ✅ Test call status updates work
3. ✅ Test voicemail recording creates voicemail_messages
4. ⏳ Add webhook signature validation
5. ⏳ Add transcription jobs for voicemail
6. ⏳ Add AI summarization

## Quick Reference

### Webhook Endpoints

- **Incoming Call**: `POST /api/aloha/webhooks/incoming-call`
- **Call Status**: `POST /api/aloha/webhooks/call-status`
- **Voicemail Recorded**: `POST /api/aloha/webhooks/voicemail-recorded`

### Twilio API Endpoints

- **Purchase Number**: `POST /api/telephony/twilio/purchase-number`
- **Configure Webhooks**: `POST /api/aloha/configure-webhooks`
- **List Calls**: `GET /api/aloha/calls`
- **Get Call Detail**: `GET /api/aloha/calls/:id`

### Environment Variables

```bash
TWILIO_ACCOUNT_SID=AC...
TWILIO_API_KEY=SK...
TWILIO_API_SECRET=...
NEXT_PUBLIC_APP_URL=https://your-domain.com
```



