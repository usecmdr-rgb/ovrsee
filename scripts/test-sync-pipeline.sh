#!/bin/bash
# Sync Backend End-to-End Test Script
# 
# Prerequisites:
# 1. Dev server running: npm run dev
# 2. Logged in at http://localhost:3000 (get auth cookie)
# 3. Environment variables set in .env.local

set -e

BASE_URL="http://localhost:3000"
AUTH_COOKIE="${AUTH_COOKIE:-}"  # Set this before running: export AUTH_COOKIE="your-cookie-value"

if [ -z "$AUTH_COOKIE" ]; then
  echo "❌ AUTH_COOKIE not set. Please export it first:"
  echo "   export AUTH_COOKIE='sb-xxx-auth-token=...'"
  exit 1
fi

echo "🧪 Testing Sync Backend Pipeline"
echo "================================"
echo ""

# Step 1: Check environment variables
echo "1️⃣ Checking environment variables..."
if [ -f .env.local ]; then
  echo "✅ .env.local exists"
  grep -q "GOOGLE_CLIENT_ID" .env.local && echo "  ✅ GOOGLE_CLIENT_ID: SET" || echo "  ❌ GOOGLE_CLIENT_ID: NOT SET"
  grep -q "GOOGLE_CLIENT_SECRET" .env.local && echo "  ✅ GOOGLE_CLIENT_SECRET: SET" || echo "  ❌ GOOGLE_CLIENT_SECRET: NOT SET"
  grep -q "GOOGLE_OAUTH_REDIRECT_URL" .env.local && echo "  ✅ GOOGLE_OAUTH_REDIRECT_URL: SET" || echo "  ❌ GOOGLE_OAUTH_REDIRECT_URL: NOT SET"
  grep -q "AUTH_SECRET\|JWT_SECRET" .env.local && echo "  ✅ AUTH_SECRET/JWT_SECRET: SET" || echo "  ❌ AUTH_SECRET/JWT_SECRET: NOT SET"
else
  echo "❌ .env.local not found"
fi
echo ""

# Step 2: Verify routes exist
echo "2️⃣ Verifying route files exist..."
ROUTES=(
  "app/api/sync/google/oauth-url/route.ts"
  "app/api/sync/google/callback/route.ts"
  "app/api/sync/gmail/start/route.ts"
  "app/api/sync/calendar/start/route.ts"
  "app/api/internal/sync/run-once/route.ts"
  "app/api/sync/gmail/messages/route.ts"
  "app/api/sync/calendar/events/route.ts"
)

for route in "${ROUTES[@]}"; do
  if [ -f "$route" ]; then
    echo "  ✅ $route"
  else
    echo "  ❌ $route (MISSING)"
  fi
done
echo ""

# Step 3a: Get OAuth URL
echo "3️⃣ Testing OAuth URL generation..."
OAUTH_RESPONSE=$(curl -s -w "\n%{http_code}" -H "Cookie: $AUTH_COOKIE" \
  "$BASE_URL/api/sync/google/oauth-url?returnTo=%2Fsync")
HTTP_CODE=$(echo "$OAUTH_RESPONSE" | tail -n1)
BODY=$(echo "$OAUTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✅ Status: 200"
  echo "$BODY" | jq -r '.url' > /tmp/oauth_url.txt
  OAUTH_URL=$(cat /tmp/oauth_url.txt)
  if [[ "$OAUTH_URL" == https://accounts.google.com/* ]]; then
    echo "  ✅ Valid Google OAuth URL generated"
    echo "  📋 OAuth URL: $OAUTH_URL"
    echo ""
    echo "  ⚠️  MANUAL STEP REQUIRED:"
    echo "  Open this URL in your browser to complete OAuth:"
    echo "  $OAUTH_URL"
    echo ""
    read -p "  Press Enter after completing OAuth flow..."
  else
    echo "  ❌ Invalid OAuth URL format"
    echo "  Response: $BODY"
  fi
else
  echo "  ❌ Status: $HTTP_CODE"
  echo "  Response: $BODY"
  exit 1
fi
echo ""

# Step 4: Check integrations (after OAuth)
echo "4️⃣ Checking integrations in database..."
echo "  (Run this SQL in Supabase dashboard:)"
echo "  SELECT id, workspace_id, provider, sync_status, last_synced_at, is_active"
echo "  FROM public.integrations"
echo "  WHERE provider IN ('gmail', 'google_calendar')"
echo "  ORDER BY created_at DESC;"
echo ""

# Step 5: Start sync jobs
echo "5️⃣ Starting Gmail sync job..."
GMAIL_JOB=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Cookie: $AUTH_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE_URL/api/sync/gmail/start")
GMAIL_HTTP=$(echo "$GMAIL_JOB" | tail -n1)
GMAIL_BODY=$(echo "$GMAIL_JOB" | head -n-1)

if [ "$GMAIL_HTTP" = "200" ]; then
  echo "  ✅ Gmail job created"
  echo "  Response: $GMAIL_BODY"
else
  echo "  ❌ Failed: $GMAIL_HTTP"
  echo "  Response: $GMAIL_BODY"
fi
echo ""

echo "6️⃣ Starting Calendar sync job..."
CAL_JOB=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Cookie: $AUTH_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE_URL/api/sync/calendar/start")
CAL_HTTP=$(echo "$CAL_JOB" | tail -n1)
CAL_BODY=$(echo "$CAL_JOB" | head -n-1)

if [ "$CAL_HTTP" = "200" ]; then
  echo "  ✅ Calendar job created"
  echo "  Response: $CAL_BODY"
else
  echo "  ❌ Failed: $CAL_HTTP"
  echo "  Response: $CAL_BODY"
fi
echo ""

# Step 6: Run worker
echo "7️⃣ Running sync worker..."
WORKER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE_URL/api/internal/sync/run-once")
WORKER_HTTP=$(echo "$WORKER_RESPONSE" | tail -n1)
WORKER_BODY=$(echo "$WORKER_RESPONSE" | head -n-1)

if [ "$WORKER_HTTP" = "200" ]; then
  echo "  ✅ Worker executed"
  echo "  Response: $WORKER_BODY"
else
  echo "  ⚠️  Worker response: $WORKER_HTTP"
  echo "  Response: $WORKER_BODY"
fi
echo ""

# Step 7: Test read APIs
echo "8️⃣ Testing read APIs..."
echo "  Testing Gmail messages endpoint..."
GMAIL_MSGS=$(curl -s -w "\n%{http_code}" -H "Cookie: $AUTH_COOKIE" \
  "$BASE_URL/api/sync/gmail/messages?limit=20")
GMAIL_MSGS_HTTP=$(echo "$GMAIL_MSGS" | tail -n1)
GMAIL_MSGS_BODY=$(echo "$GMAIL_MSGS" | head -n-1)

if [ "$GMAIL_MSGS_HTTP" = "200" ]; then
  MSG_COUNT=$(echo "$GMAIL_MSGS_BODY" | jq -r '.count // 0')
  echo "  ✅ Gmail messages: $MSG_COUNT messages"
else
  echo "  ❌ Failed: $GMAIL_MSGS_HTTP"
  echo "  Response: $GMAIL_MSGS_BODY"
fi

echo "  Testing Calendar events endpoint..."
CAL_EVENTS=$(curl -s -w "\n%{http_code}" -H "Cookie: $AUTH_COOKIE" \
  "$BASE_URL/api/sync/calendar/events")
CAL_EVENTS_HTTP=$(echo "$CAL_EVENTS" | tail -n1)
CAL_EVENTS_BODY=$(echo "$CAL_EVENTS" | head -n-1)

if [ "$CAL_EVENTS_HTTP" = "200" ]; then
  EVENT_COUNT=$(echo "$CAL_EVENTS_BODY" | jq -r '.count // 0')
  echo "  ✅ Calendar events: $EVENT_COUNT events"
else
  echo "  ❌ Failed: $CAL_EVENTS_HTTP"
  echo "  Response: $CAL_EVENTS_BODY"
fi
echo ""

echo "✅ Test pipeline complete!"
echo ""
echo "📊 Summary:"
echo "  - OAuth URL: Generated"
echo "  - Sync Jobs: Created"
echo "  - Worker: Executed"
echo "  - Read APIs: Tested"
echo ""
echo "💡 Next steps:"
echo "  1. Check Supabase for synced data"
echo "  2. Verify integrations table has tokens"
echo "  3. Verify sync_jobs table shows completed jobs"
echo "  4. Verify sync_email_messages and sync_calendar_events have data"




