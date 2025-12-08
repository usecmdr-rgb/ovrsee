#!/bin/bash
# ============================================================================
# Test Aloha Webhooks - Call Status Update
# ============================================================================
# Simulates a Twilio call status update webhook
#
# Usage:
#   ./scripts/test-call-status.sh <CallSid>
#   or
#   bash scripts/test-call-status.sh <CallSid>
#
# Example:
#   ./scripts/test-call-status.sh CA1234567890abcdef
# ============================================================================

if [ -z "$1" ]; then
  echo "Error: CallSid is required"
  echo "Usage: ./scripts/test-call-status.sh <CallSid>"
  exit 1
fi

CALL_SID="$1"
BASE_URL="${BASE_URL:-http://localhost:3000}"
ENDPOINT="${BASE_URL}/api/aloha/webhooks/call-status"

# Call status (completed, no-answer, busy, failed, etc.)
CALL_STATUS="${CALL_STATUS:-completed}"
CALL_DURATION="${CALL_DURATION:-45}" # seconds

echo "Testing Aloha Call Status Webhook"
echo "=================================="
echo "Endpoint: ${ENDPOINT}"
echo "CallSid: ${CALL_SID}"
echo "Status: ${CALL_STATUS}"
echo "Duration: ${CALL_DURATION}s"
echo ""

# Send POST request with Twilio form data
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -d "CallSid=${CALL_SID}" \
  -d "CallStatus=${CALL_STATUS}" \
  -d "CallDuration=${CALL_DURATION}" \
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
  echo "✅ Status update accepted successfully"
  echo ""
  echo "Next steps:"
  echo "1. Check call_logs table - status should be updated to '${CALL_STATUS}'"
  echo "2. Check call_logs table - duration_seconds should be ${CALL_DURATION}"
  if [ "$CALL_STATUS" = "completed" ]; then
    echo "3. Run: ./scripts/test-voicemail-recorded.sh ${CALL_SID}"
  fi
else
  echo "❌ Status update failed with status ${http_status}"
  exit 1
fi




