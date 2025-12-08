#!/bin/bash

# Script to set up environment variables for mobile app from web app config

echo "🔧 Setting up mobile app environment variables..."
echo ""

# Paths
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_ENV_FILE="$ROOT_DIR/.env.local"
MOBILE_ENV_FILE="$MOBILE_DIR/.env"

# Check if web app .env.local exists
if [ ! -f "$WEB_ENV_FILE" ]; then
    echo "❌ Error: Could not find $WEB_ENV_FILE"
    echo ""
    echo "Please ensure your web app's .env.local file exists in the root directory."
    exit 1
fi

# Extract Supabase URL and Key from web app config
SUPABASE_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$WEB_ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs)
SUPABASE_KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" "$WEB_ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs)

# Validate values
if [ -z "$SUPABASE_URL" ]; then
    echo "❌ Error: Could not find NEXT_PUBLIC_SUPABASE_URL in $WEB_ENV_FILE"
    exit 1
fi

if [ -z "$SUPABASE_KEY" ]; then
    echo "❌ Error: Could not find NEXT_PUBLIC_SUPABASE_ANON_KEY in $WEB_ENV_FILE"
    exit 1
fi

# Create mobile app .env file
echo "📝 Creating $MOBILE_ENV_FILE..."
cat > "$MOBILE_ENV_FILE" << EOF
# Supabase Configuration
# Auto-generated from web app's .env.local
# These values MUST match the web app's Supabase configuration

EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_KEY
EOF

echo "✅ Successfully created $MOBILE_ENV_FILE"
echo ""
echo "📋 Values copied:"
echo "   EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL"
echo "   EXPO_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_KEY:0:20}... (truncated for security)"
echo ""
echo "🚀 Next steps:"
echo "   1. Restart your Expo server: npx expo start -c"
echo "   2. Try logging in again"
echo ""
echo "✨ Done!"




