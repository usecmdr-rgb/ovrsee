#!/bin/bash

# Script to fix Gmail redirect URI in .env.local
# This ensures the redirect URI matches what's configured in Google Cloud Console

ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: $ENV_FILE not found"
  exit 1
fi

echo "🔧 Fixing Gmail Redirect URI"
echo "============================"
echo ""

# Get the app URL from .env.local or default to localhost:3001
APP_URL=$(grep "NEXT_PUBLIC_APP_URL" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
if [ -z "$APP_URL" ]; then
  APP_URL="http://localhost:3001"
fi

REDIRECT_URI="${APP_URL}/api/gmail/callback"

echo "📝 Setting redirect URI to: $REDIRECT_URI"
echo ""

# Create backup
cp "$ENV_FILE" "$ENV_FILE.backup"
echo "✅ Created backup: $ENV_FILE.backup"

# Uncomment and update GMAIL_REDIRECT_URI
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  # First, uncomment if commented
  sed -i '' "s|^# GMAIL_REDIRECT_URI=.*|GMAIL_REDIRECT_URI=$REDIRECT_URI|" "$ENV_FILE"
  # Then update if already uncommented
  sed -i '' "s|^GMAIL_REDIRECT_URI=.*|GMAIL_REDIRECT_URI=$REDIRECT_URI|" "$ENV_FILE"
else
  # Linux
  sed -i "s|^# GMAIL_REDIRECT_URI=.*|GMAIL_REDIRECT_URI=$REDIRECT_URI|" "$ENV_FILE"
  sed -i "s|^GMAIL_REDIRECT_URI=.*|GMAIL_REDIRECT_URI=$REDIRECT_URI|" "$ENV_FILE"
fi

echo "✅ Updated GMAIL_REDIRECT_URI in $ENV_FILE"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo ""
echo "1. Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials"
echo "2. Click on your OAuth 2.0 Client ID"
echo "3. Scroll to 'Authorized redirect URIs'"
echo "4. Make sure this EXACT URI is listed (no trailing slash):"
echo "   $REDIRECT_URI"
echo "5. If it's missing or different, click '+ ADD URI' and add it"
echo "6. Click 'SAVE'"
echo ""
echo "7. Restart your dev server:"
echo "   npm run dev"
echo ""
echo "8. Test the connection at: http://localhost:3001/api/gmail/test"




