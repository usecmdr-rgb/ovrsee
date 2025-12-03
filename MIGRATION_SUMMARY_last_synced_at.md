# Migration Summary: Standardize on `last_synced_at`

## ✅ Completed Tasks

### 1. Found All Occurrences

**SQL Migrations with `last_sync_at`:**
- ✅ `20250115000000_core_aloha_schema.sql` line 222 - `public.integrations.last_sync_at`
- ✅ `20241213000000_email_queue.sql` line 102 - `public.gmail_connections.last_sync_at` (separate table)
- ✅ `ALL_MIGRATIONS_COMBINED.sql` line 3599 - references `last_sync_at`
- ✅ `REMAINING_MIGRATIONS.sql` line 3001 - references `last_sync_at`

**Code Files Using `last_sync_at`:**
- `lib/gmail/sync.ts` - uses on `gmail_connections` table
- `app/api/gmail/status/route.ts` - uses on `gmail_connections` table
- `app/api/gmail/sync/route.ts` - uses on `gmail_connections` table
- `app/api/calendar/sync/route.ts` - uses on `calendar_connections` table
- `types/database.ts` - type definition for `gmail_connections`

**Note:** All code usage is for `gmail_connections` and `calendar_connections` tables, NOT `integrations`. The `integrations` table rename is safe and won't affect existing code.

### 2. Created Safe Rename Migration

**File:** `supabase/migrations/20250116000001_rename_last_sync_at_to_last_synced_at.sql`

**Features:**
- ✅ Idempotent - safe to run multiple times
- ✅ Handles all edge cases:
  - If `last_sync_at` exists and `last_synced_at` doesn't → rename
  - If `last_synced_at` already exists → do nothing
  - If both exist (shouldn't happen) → merge data and drop old column
  - If neither exists → do nothing
- ✅ Preserves all existing data
- ✅ Adds helpful comment to column

### 3. Updated Sync Migration

**File:** `supabase/migrations/20250116000000_sync_schema.sql`

**Changes:**
- ✅ Removed commented-out `last_synced_at` addition code
- ✅ Updated comment to reference the rename migration
- ✅ Added comment for `last_synced_at` column in comments section
- ✅ Migration now assumes `last_synced_at` will exist (handled by rename migration)

## 📋 Migration Execution Order

Run migrations in this order:

1. **First:** `20250116000000_sync_schema.sql`
   - Adds `sync_status` column
   - Creates sync tables (sync_jobs, sync_email_messages, sync_calendar_events)
   - Does NOT add `last_synced_at` (handled by next migration)

2. **Second:** `20250116000001_rename_last_sync_at_to_last_synced_at.sql`
   - Renames `last_sync_at` → `last_synced_at` on `public.integrations`
   - Safe to run even if previous migration already ran

## ✅ Verification Checklist

After running migrations, verify:

- [ ] `public.integrations` table has `last_synced_at` column (not `last_sync_at`)
- [ ] `public.integrations` table has `sync_status` column
- [ ] All sync tables created successfully
- [ ] No duplicate columns on `integrations` table
- [ ] All existing data preserved

## 🔍 SQL to Verify

```sql
-- Check integrations table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'integrations'
  AND column_name IN ('last_sync_at', 'last_synced_at', 'sync_status')
ORDER BY column_name;

-- Should show:
-- - last_synced_at (TIMESTAMPTZ, nullable)
-- - sync_status (TEXT, nullable, default 'disconnected')
-- - Should NOT show last_sync_at
```

## 📝 Notes

- **`gmail_connections` and `calendar_connections` tables:** These tables also have `last_sync_at` but are separate tables. They are NOT affected by this migration. If you want to rename those as well, that would be a separate migration.

- **Code Updates:** No code changes needed immediately since all code references are to `gmail_connections` and `calendar_connections` tables, not `integrations`. However, if you add code that uses `integrations.last_synced_at`, make sure to use the new name.

- **Backward Compatibility:** The rename migration is safe and won't break anything. If you have any code that queries `integrations.last_sync_at`, it will need to be updated to use `last_synced_at` instead.



