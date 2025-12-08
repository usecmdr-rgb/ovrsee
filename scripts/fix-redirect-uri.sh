#!/bin/bash

# Fix Gmail redirect URI in .env.local
ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: $ENV_FILE not found"
  exit 1
fi

echo "🔧 Fixing Gmail Redirect URI"
echo "============================"

# Create backup
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ Created backup"

# The correct redirect URI
REDIRECT_URI="http://localhost:3001/api/gmail/callback"

# Remove the broken line and add the correct one
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS - remove any line with GMAIL_REDIRECT_URI (including commented ones)
  sed -i '' '/^#.*GMAIL_REDIRECT_URI/d' "$ENV_FILE"
  sed -i '' '/^GMAIL_REDIRECT_URI/d' "$ENV_FILE"
  
  # Add the correct redirect URI after GMAIL_CLIENT_SECRET
  sed -i '' "/^GMAIL_CLIENT_SECRET=/a\\
# Gmail OAuth redirect URI (must match Google Cloud Console exactly)
GMAIL_REDIRECT_URI=$REDIRECT_URI
" "$ENV_FILE"
else
  # Linux
  sed -i '/^#.*GMAIL_REDIRECT_URI/d' "$ENV_FILE"
  sed -i '/^GMAIL_REDIRECT_URI/d' "$ENV_FILE"
  sed -i "/^GMAIL_CLIENT_SECRET=/a\\
# Gmail OAuth redirect URI (must match Google Cloud Console exactly)
GMAIL_REDIRECT_URI=$REDIRECT_URI
" "$ENV_FILE"
fi

echo "✅ Updated GMAIL_REDIRECT_URI to: $REDIRECT_URI"
echo ""
echo "⚠️  IMPORTANT:"
echo "1. Make sure this redirect URI is in Google Cloud Console:"
echo "   $REDIRECT_URI"
echo "2. Restart your dev server: npm run dev"




