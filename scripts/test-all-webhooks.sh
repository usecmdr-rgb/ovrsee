#!/bin/bash
# ============================================================================
# Test All Aloha Webhooks - Full Flow
# ============================================================================
# Runs all webhook tests in sequence to simulate a complete call flow
#
# Usage:
#   ./scripts/test-all-webhooks.sh
#   or
#   bash scripts/test-all-webhooks.sh
# ============================================================================

set -e

echo "=========================================="
echo "Testing Complete Aloha Webhook Flow"
echo "=========================================="
echo ""

# Step 1: Incoming call
echo "Step 1: Simulating incoming call..."
CALL_SID_OUTPUT=$(./scripts/test-incoming-call.sh 2>&1)
CALL_SID=$(echo "$CALL_SID_OUTPUT" | grep "CallSid:" | awk '{print $2}')

if [ -z "$CALL_SID" ]; then
  echo "❌ Failed to get CallSid from incoming call webhook"
  exit 1
fi

echo "✅ Incoming call webhook successful"
echo "CallSid: ${CALL_SID}"
echo ""
sleep 2

# Step 2: Call status update (completed)
echo "Step 2: Simulating call status update (completed)..."
export CALL_STATUS="completed"
export CALL_DURATION="45"
./scripts/test-call-status.sh "$CALL_SID" > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Call status update successful"
else
  echo "❌ Call status update failed"
  exit 1
fi
echo ""
sleep 2

# Step 3: Voicemail recorded
echo "Step 3: Simulating voicemail recording..."
./scripts/test-voicemail-recorded.sh "$CALL_SID" > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Voicemail recorded webhook successful"
else
  echo "❌ Voicemail webhook failed"
  exit 1
fi
echo ""

echo "=========================================="
echo "✅ All webhook tests completed successfully!"
echo "=========================================="
echo ""
echo "CallSid: ${CALL_SID}"
echo ""
echo "Verify in database:"
echo "  SELECT * FROM call_logs WHERE twilio_call_sid = '${CALL_SID}';"
echo "  SELECT * FROM voicemail_messages WHERE call_log_id IN ("
echo "    SELECT id FROM call_logs WHERE twilio_call_sid = '${CALL_SID}'"
echo "  );"
echo ""




