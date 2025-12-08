#!/bin/bash
# Script to apply the workspace_seat_invites migration
# Usage: ./scripts/apply-migration.sh

set -e

echo "=========================================="
echo "Applying Workspace Seat Invites Migration"
echo "=========================================="
echo ""

# Check if Supabase CLI is available
if command -v supabase &> /dev/null; then
    echo "Using Supabase CLI..."
    supabase db push
    echo "Migration applied via Supabase CLI"
else
    echo "Supabase CLI not found."
    echo ""
    echo "To apply this migration manually:"
    echo "1. Open your Supabase Dashboard"
    echo "2. Go to SQL Editor"
    echo "3. Copy and paste the contents of:"
    echo "   supabase/migrations/20250120000000_workspace_seat_invites.sql"
    echo "   OR"
    echo "   scripts/apply-seat-invites-migration.sql"
    echo "4. Click 'Run'"
    echo ""
    echo "Alternatively, if you have psql access:"
    echo "  psql -h <your-supabase-host> -U postgres -d postgres -f supabase/migrations/20250120000000_workspace_seat_invites.sql"
fi

echo ""
echo "=========================================="
echo "Migration script completed"
echo "=========================================="


