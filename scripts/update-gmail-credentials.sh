#!/bin/bash

# Script to update Gmail OAuth credentials in .env.local
# Usage: ./scripts/update-gmail-credentials.sh

ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: $ENV_FILE not found"
  exit 1
fi

echo "🔧 Gmail OAuth Credentials Updater"
echo "===================================="
echo ""
echo "You need your Google Cloud Console credentials:"
echo "1. Go to: https://console.cloud.google.com/apis/credentials"
echo "2. Click on your OAuth client (CommanderX)"
echo "3. Copy the Client ID and Client Secret"
echo ""

read -p "Enter your Gmail Client ID: " CLIENT_ID
read -sp "Enter your Gmail Client Secret: " CLIENT_SECRET
echo ""

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  echo "❌ Error: Both Client ID and Secret are required"
  exit 1
fi

# Create backup
cp "$ENV_FILE" "$ENV_FILE.backup"
echo "✅ Created backup: $ENV_FILE.backup"

# Update the file using sed (works on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  sed -i '' "s|GMAIL_CLIENT_ID=.*|GMAIL_CLIENT_ID=$CLIENT_ID|" "$ENV_FILE"
  sed -i '' "s|GMAIL_CLIENT_SECRET=.*|GMAIL_CLIENT_SECRET=$CLIENT_SECRET|" "$ENV_FILE"
else
  # Linux
  sed -i "s|GMAIL_CLIENT_ID=.*|GMAIL_CLIENT_ID=$CLIENT_ID|" "$ENV_FILE"
  sed -i "s|GMAIL_CLIENT_SECRET=.*|GMAIL_CLIENT_SECRET=$CLIENT_SECRET|" "$ENV_FILE"
fi

echo "✅ Updated $ENV_FILE with your credentials"
echo ""
echo "⚠️  IMPORTANT: Restart your dev server for changes to take effect!"
echo "   Run: npm run dev"




