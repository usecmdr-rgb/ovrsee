#!/bin/bash
# ============================================================================
# Configure Twilio Phone Number Webhooks
# ============================================================================
# Updates a Twilio phone number with webhook URLs for Aloha
#
# Usage:
#   ./scripts/configure-twilio-webhooks.sh <PHONE_NUMBER_SID> <BASE_URL>
#
# Example:
#   ./scripts/configure-twilio-webhooks.sh PN1234567890abcdef https://ovrsee.ai
# ============================================================================

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Error: Phone Number SID and Base URL are required"
  echo "Usage: ./scripts/configure-twilio-webhooks.sh <PHONE_NUMBER_SID> <BASE_URL>"
  echo "Example: ./scripts/configure-twilio-webhooks.sh PN1234567890abcdef https://ovrsee.ai"
  exit 1
fi

PHONE_NUMBER_SID="$1"
BASE_URL="$2"

# Remove trailing slash
BASE_URL="${BASE_URL%/}"

# Check for Twilio credentials
if [ -z "$TWILIO_ACCOUNT_SID" ] || [ -z "$TWILIO_AUTH_TOKEN" ]; then
  echo "Error: Twilio credentials not set"
  echo "Please set: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN"
  exit 1
fi

echo "Configuring Twilio Webhooks"
echo "============================"
echo "Phone Number SID: ${PHONE_NUMBER_SID}"
echo "Base URL: ${BASE_URL}"
echo ""

VOICE_URL="${BASE_URL}/api/aloha/webhooks/incoming-call"
STATUS_CALLBACK_URL="${BASE_URL}/api/aloha/webhooks/call-status"

echo "Voice URL: ${VOICE_URL}"
echo "Status Callback URL: ${STATUS_CALLBACK_URL}"
echo ""

# Update Twilio phone number
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${PHONE_NUMBER_SID}.json" \
  -u "${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}" \
  --data-urlencode "VoiceUrl=${VOICE_URL}" \
  --data-urlencode "StatusCallback=${STATUS_CALLBACK_URL}" \
  --data-urlencode "StatusCallbackEvent=initiated ringing answered completed" \
  --data-urlencode "StatusCallbackMethod=POST")

# Extract HTTP status and body
http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

if [ "$http_status" = "200" ]; then
  echo "✅ Webhooks configured successfully!"
  echo ""
  echo "Response:"
  echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
  echo "❌ Failed to configure webhooks (HTTP ${http_status})"
  echo ""
  echo "Response:"
  echo "$body"
  exit 1
fi

echo ""
echo "Next steps:"
echo "1. Test by calling your Twilio number"
echo "2. Check call_logs table for new entries"
echo "3. Verify webhooks in Twilio Console → Phone Numbers → Your Number"



