#!/bin/bash

# Script to update Google OAuth credentials in .env.local
# Usage: ./scripts/update-google-oauth.sh <CLIENT_ID> <CLIENT_SECRET>

if [ $# -ne 2 ]; then
  echo "Usage: $0 <CLIENT_ID> <CLIENT_SECRET>"
  echo ""
  echo "Example:"
  echo "  $0 123456789-abcdefgh.apps.googleusercontent.com GOCSPX-xyz123"
  exit 1
fi

CLIENT_ID=$1
CLIENT_SECRET=$2
ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: $ENV_FILE not found"
  exit 1
fi

# Backup original file
cp "$ENV_FILE" "$ENV_FILE.backup"
echo "✅ Created backup: $ENV_FILE.backup"

# Update GOOGLE_CLIENT_ID
if grep -q "^GOOGLE_CLIENT_ID=" "$ENV_FILE"; then
  sed -i.bak "s|^GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=$CLIENT_ID|" "$ENV_FILE"
  echo "✅ Updated GOOGLE_CLIENT_ID"
else
  echo "GOOGLE_CLIENT_ID=$CLIENT_ID" >> "$ENV_FILE"
  echo "✅ Added GOOGLE_CLIENT_ID"
fi

# Update GOOGLE_CLIENT_SECRET
if grep -q "^GOOGLE_CLIENT_SECRET=" "$ENV_FILE"; then
  sed -i.bak "s|^GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=$CLIENT_SECRET|" "$ENV_FILE"
  echo "✅ Updated GOOGLE_CLIENT_SECRET"
else
  echo "GOOGLE_CLIENT_SECRET=$CLIENT_SECRET" >> "$ENV_FILE"
  echo "✅ Added GOOGLE_CLIENT_SECRET"
fi

# Ensure redirect URI is set
if ! grep -q "^GOOGLE_OAUTH_REDIRECT_URL=" "$ENV_FILE"; then
  echo "GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3000/api/sync/google/callback" >> "$ENV_FILE"
  echo "✅ Added GOOGLE_OAUTH_REDIRECT_URL"
fi

echo ""
echo "✅ Updated $ENV_FILE with new credentials"
echo ""
echo "📋 Verification:"
grep "^GOOGLE_CLIENT_ID=" "$ENV_FILE" | head -1
grep "^GOOGLE_CLIENT_SECRET=" "$ENV_FILE" | head -1 | sed 's/=.*/=***HIDDEN***/'
grep "^GOOGLE_OAUTH_REDIRECT_URL=" "$ENV_FILE" | head -1
echo ""
echo "⚠️  Next steps:"
echo "1. Restart your dev server: npm run dev"
echo "2. Try connecting Gmail again"
echo "3. If you need to revert: cp $ENV_FILE.backup $ENV_FILE"


