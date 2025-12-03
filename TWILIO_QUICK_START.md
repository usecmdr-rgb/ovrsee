# Twilio Quick Start Guide

## 1. Get Twilio Credentials

1. Sign up at https://www.twilio.com/try-twilio
2. Get your credentials from https://console.twilio.com/us1/account/settings/credentials
   - **Account SID**: `AC...`
   - **Auth Token**: `your_auth_token` (or create API Key/Secret)

3. Set environment variables:
   ```bash
   export TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   export TWILIO_AUTH_TOKEN="your_auth_token"
   # OR use API Key/Secret:
   export TWILIO_API_KEY="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   export TWILIO_API_SECRET="your_api_secret"
   ```

## 2. Purchase a Phone Number

### Via Twilio Console (Easiest)

1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/search
2. Search and purchase a number
3. Note the **Phone Number SID** (starts with `PN...`)

### Via API

```bash
POST /api/telephony/twilio/purchase-number
Authorization: Bearer YOUR_TOKEN
{
  "phoneNumber": "+15551234567"
}
```

## 3. Configure Webhooks

### Option A: Via API Endpoint (Recommended)

```bash
POST /api/aloha/configure-webhooks
Authorization: Bearer YOUR_TOKEN
{
  "phoneNumberId": "uuid-from-user_phone_numbers-table"
}
```

### Option B: Via Script

```bash
export TWILIO_ACCOUNT_SID="AC..."
export TWILIO_AUTH_TOKEN="..."
./scripts/configure-twilio-webhooks.sh PN1234567890abcdef https://your-domain.com
```

### Option C: Via Twilio Console

1. Go to Phone Numbers → Manage → Active Numbers
2. Click your number
3. Set:
   - **A CALL COMES IN**: `https://your-domain.com/api/aloha/webhooks/incoming-call`
   - **STATUS CALLBACK URL**: `https://your-domain.com/api/aloha/webhooks/call-status`
   - **STATUS CALLBACK METHOD**: POST

## 4. Test with Real Call

1. Call your Twilio number from any phone
2. Check server logs for webhook requests
3. Verify in database:

```sql
SELECT * FROM call_logs 
WHERE to_number = '+15551234567'
ORDER BY started_at DESC
LIMIT 5;
```

## 5. Development Setup (ngrok)

For local testing, expose your server with ngrok:

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000

# Use the HTTPS URL in Twilio webhooks
# Example: https://abc123.ngrok.io/api/aloha/webhooks/incoming-call
```

## Troubleshooting

### Webhooks Not Working

- ✅ Check webhook URLs are HTTPS (required for production)
- ✅ Verify URLs are publicly accessible
- ✅ Check Twilio Console → Monitor → Logs for errors
- ✅ Check server logs for incoming requests

### Phone Number Not Found

- ✅ Verify phone number exists in `user_phone_numbers` table
- ✅ Check `is_active = TRUE`
- ✅ Verify `workspace_id` matches user's workspace

### Call Logs Not Created

- ✅ Check server logs for webhook errors
- ✅ Verify workspace exists
- ✅ Check RLS policies allow operation

## Next Steps

Once working:
1. ✅ Test incoming calls
2. ✅ Test voicemail recording
3. ⏳ Add transcription
4. ⏳ Add AI summarization



