# Migration Plan: Standardize on `last_synced_at`

## Summary of Current State

### Where `last_sync_at` is Defined in SQL Migrations:

1. **`public.integrations` table** (Line 222 in `20250115000000_core_aloha_schema.sql`)
   - Column: `last_sync_at TIMESTAMPTZ`
   - Status: ✅ Exists in migrations (may already be in production)

2. **`public.gmail_connections` table** (Line 102 in `20241213000000_email_queue.sql`)
   - Column: `last_sync_at TIMESTAMPTZ`
   - Status: ✅ Exists in migrations (separate table, not part of this refactor)

3. **`public.calendar_connections` table** (Used in code but not in migrations)
   - Column: `last_sync_at` (referenced in `app/api/calendar/sync/route.ts` line 151)
   - Status: ⚠️ Used in code but not defined in migrations (may need separate fix)

### Where `last_synced_at` is Defined:

- **NOWHERE** - This column name does not currently exist in any migration
- Only mentioned in comments in `20250116000000_sync_schema.sql`

### Code Usage:

**Files using `last_sync_at`:**
- `lib/gmail/sync.ts` (lines 159, 228, 351) - uses on `gmail_connections`
- `app/api/gmail/status/route.ts` (lines 34, 55) - uses on `gmail_connections`
- `app/api/gmail/sync/route.ts` (lines 106, 118) - uses on `gmail_connections`
- `app/api/calendar/sync/route.ts` (line 151) - uses on `calendar_connections`
- `types/database.ts` (line 282) - type definition for `gmail_connections`

**Note:** All code usage is for `gmail_connections` and `calendar_connections` tables, NOT `integrations` table.

## Migration Strategy

### Goal:
- Standardize `public.integrations.last_sync_at` → `public.integrations.last_synced_at`
- Ensure new migrations use `last_synced_at` consistently
- Do NOT break existing data

### Plan:

1. **Create a rename migration** (safe, idempotent)
   - Check if `last_sync_at` exists on `integrations`
   - If it exists and `last_synced_at` doesn't exist, rename it
   - If both exist (shouldn't happen), drop `last_sync_at` after copying data

2. **Update the new sync migration** (`20250116000000_sync_schema.sql`)
   - Remove commented-out `last_synced_at` addition
   - Use `last_synced_at` in any references/comments
   - Ensure no duplicate column creation

3. **Future consideration:**
   - `gmail_connections` and `calendar_connections` tables also have `last_sync_at`
   - These are separate tables and can be handled separately if needed
   - For now, focus only on `integrations` table as requested



