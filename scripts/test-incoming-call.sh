#!/bin/bash
# ============================================================================
# Test Aloha Webhooks - Incoming Call
# ============================================================================
# Simulates a Twilio incoming call webhook
#
# Usage:
#   ./scripts/test-incoming-call.sh
#   or
#   bash scripts/test-incoming-call.sh
#
# Prerequisites:
#   - Set BASE_URL environment variable (default: http://localhost:3000)
#   - Update phone numbers below to match your test setup
# ============================================================================

BASE_URL="${BASE_URL:-http://localhost:3000}"
ENDPOINT="${BASE_URL}/api/aloha/webhooks/incoming-call"

# Test phone numbers (update these to match your test setup)
FROM_NUMBER="${FROM_NUMBER:-+15559876543}"
TO_NUMBER="${TO_NUMBER:-+15551234567}"

echo "Testing Aloha Incoming Call Webhook"
echo "===================================="
echo "Endpoint: ${ENDPOINT}"
echo "From: ${FROM_NUMBER}"
echo "To: ${TO_NUMBER}"
echo ""

# Generate a test CallSid
CALL_SID="CA$(openssl rand -hex 16 | tr '[:lower:]' '[:upper:]')"

# Send POST request with Twilio form data
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -d "CallSid=${CALL_SID}" \
  -d "From=${FROM_NUMBER}" \
  -d "To=${TO_NUMBER}" \
  -d "CallStatus=ringing" \
  -d "Direction=inbound" \
  -d "CallerName=Test+Caller" \
  "${ENDPOINT}")

# Extract HTTP status and body
http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

echo "Response Status: ${http_status}"
echo ""
echo "Response Body:"
echo "${body}" | head -20
echo ""

if [ "$http_status" = "200" ]; then
  echo "✅ Webhook accepted successfully"
  echo "CallSid: ${CALL_SID}"
  echo ""
  echo "Next steps:"
  echo "1. Check call_logs table for new entry with CallSid: ${CALL_SID}"
  echo "2. Run: ./scripts/test-call-status.sh ${CALL_SID}"
else
  echo "❌ Webhook failed with status ${http_status}"
  exit 1
fi



