#!/bin/bash
# ============================================================================
# Test Aloha Webhooks - Voicemail Recorded
# ============================================================================
# Simulates a Twilio voicemail recording webhook
#
# Usage:
#   ./scripts/test-voicemail-recorded.sh <CallSid>
#   or
#   bash scripts/test-voicemail-recorded.sh <CallSid>
#
# Example:
#   ./scripts/test-voicemail-recorded.sh CA1234567890abcdef
# ============================================================================

if [ -z "$1" ]; then
  echo "Error: CallSid is required"
  echo "Usage: ./scripts/test-voicemail-recorded.sh <CallSid>"
  exit 1
fi

CALL_SID="$1"
BASE_URL="${BASE_URL:-http://localhost:3000}"
ENDPOINT="${BASE_URL}/api/aloha/webhooks/voicemail-recorded"

# Generate test recording SID and URL
RECORDING_SID="RE$(openssl rand -hex 16 | tr '[:lower:]' '[:upper:]')"
RECORDING_URL="${RECORDING_URL:-https://api.twilio.com/2010-04-01/Accounts/ACxxxx/Recordings/${RECORDING_SID}.mp3}"
RECORDING_DURATION="${RECORDING_DURATION:-30}" # seconds

# Test phone numbers (update these to match your test setup)
FROM_NUMBER="${FROM_NUMBER:-+15559876543}"
TO_NUMBER="${TO_NUMBER:-+15551234567}"

echo "Testing Aloha Voicemail Recorded Webhook"
echo "========================================="
echo "Endpoint: ${ENDPOINT}"
echo "CallSid: ${CALL_SID}"
echo "RecordingSid: ${RECORDING_SID}"
echo "Recording URL: ${RECORDING_URL}"
echo "Duration: ${RECORDING_DURATION}s"
echo ""

# Send POST request with Twilio form data
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -d "CallSid=${CALL_SID}" \
  -d "RecordingSid=${RECORDING_SID}" \
  -d "RecordingUrl=${RECORDING_URL}" \
  -d "RecordingDuration=${RECORDING_DURATION}" \
  -d "From=${FROM_NUMBER}" \
  -d "To=${TO_NUMBER}" \
  "${ENDPOINT}")

# Extract HTTP status and body
http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

echo "Response Status: ${http_status}"
echo ""
echo "Response Body:"
echo "${body}"
echo ""

if [ "$http_status" = "200" ]; then
  echo "✅ Voicemail recorded webhook accepted successfully"
  echo ""
  echo "Next steps:"
  echo "1. Check voicemail_messages table for new entry with RecordingSid: ${RECORDING_SID}"
  echo "2. Check call_logs table - has_voicemail should be TRUE"
  echo "3. Check call_logs table - status should be 'voicemail'"
  echo ""
  echo "To verify in database:"
  echo "  SELECT * FROM voicemail_messages WHERE twilio_recording_sid = '${RECORDING_SID}';"
  echo "  SELECT * FROM call_logs WHERE twilio_call_sid = '${CALL_SID}';"
else
  echo "❌ Voicemail webhook failed with status ${http_status}"
  exit 1
fi




