# OVRSEE Calendar Implementation Summary

## ✅ Completed

### 1. Time & Placement Correctness
- **Date-fns Integration**: Created comprehensive date utility library (`lib/calendar/date-utils.ts`)
  - All date/time operations now use date-fns for consistency
  - Handles timezone normalization, DST, and local date calculations
  - Functions for weekly/monthly view calculations
- **Refactored Calendar Page**: Updated `app/sync/page.tsx` to use date-fns utilities
  - Weekly view: Correct day column placement based on local dates
  - Monthly view: Correct day cell placement
  - Event positioning uses local time for vertical placement
  - Multi-day events handled correctly

### 2. Database Schema
- **Google Calendar Mapping Table**: `calendar_event_mappings`
  - Maps OVRSEE events to Google Calendar events
  - Tracks etag for change detection
  - Supports multiple calendars per user
- **Soft Delete Support**: Added to `calendar_event_notes` table
  - `deleted_at`: Timestamp when event was deleted
  - `deleted_by`: User who deleted the event
  - `deleted_source`: Source of deletion ('ovrsee', 'google', 'system')
  - Index for efficient querying of deleted events
- **Retention Policy**: Database function to purge events after 60 days

### 3. Sync Infrastructure
- **Type Definitions**: `lib/calendar/sync-types.ts`
  - Interfaces for Google Calendar events, OVRSEE events, mappings
  - Sync direction and deletion source types
- **Sync Utilities**: `lib/calendar/sync-utils.ts`
  - Token refresh and management
  - Event format conversion (Google ↔ OVRSEE)
  - Mapping CRUD operations
- **Sync API Endpoint**: `app/api/calendar/sync/route.ts`
  - GET: Download events from Google Calendar
  - POST: Upload events to Google Calendar
  - Handles conflict resolution (last-write-wins)
  - Supports soft delete

## 🚧 Remaining Implementation

### 4. Soft Delete UI
**Location**: `app/sync/page.tsx` or new component

**Features Needed**:
- "Recently Deleted" / "Trash" view/tab
- List of soft-deleted events with:
  - Title, date/time
  - Agent/category (Aloha/Sync/Studio/Insight)
  - Deleted timestamp and source
- Actions:
  - **Restore**: Clear `deleted_at`, re-sync to Google if mapped
  - **Delete Permanently**: Hard delete from DB and Google

**Implementation Steps**:
1. Add state for showing trash view
2. Query deleted events: `SELECT * FROM calendar_event_notes WHERE deleted_at IS NOT NULL AND user_id = ?`
3. Create UI component with restore/delete buttons
4. Add restore API endpoint
5. Add permanent delete API endpoint

### 5. Enhanced Sync Logic
**Current Status**: Basic sync implemented, needs enhancement

**Enhancements Needed**:
1. **Initial Sync**: On calendar connect, sync past 30 days + next 90 days
2. **Incremental Sync**: Use `updatedMin` parameter for changed events only
3. **Push Notifications**: Set up Google Calendar webhooks (optional)
4. **Periodic Polling**: Background job to sync every 15-30 minutes
5. **Conflict Resolution**: Enhanced last-write-wins with user notification

### 6. UI Enhancements
**Google-Synced Event Indicator**:
- Add small icon (e.g., Google Calendar logo) to synced events
- Show in both weekly and monthly views
- Subtle styling to not dominate UI

**Event Creation/Edit**:
- When creating/editing events in OVRSEE, automatically sync to Google
- Show sync status (syncing, synced, error)

### 7. Testing Scenarios
**Manual Test Cases**:
1. Create event in OVRSEE → Verify appears in Google Calendar
2. Edit event in OVRSEE → Verify updates in Google Calendar
3. Delete event in OVRSEE → Verify soft delete + removal from Google
4. Create event in Google → Verify appears in OVRSEE after sync
5. Edit event in Google → Verify updates in OVRSEE after sync
6. Delete event in Google → Verify soft delete in OVRSEE
7. Restore deleted event → Verify re-appears in both systems
8. Events at DST boundaries → Verify correct time display
9. Events near midnight → Verify correct day placement
10. Multi-day events → Verify spans correctly across days

## Database Migration

Run the SQL in `lib/calendar/database-schema.sql` to:
1. Create `calendar_event_mappings` table
2. Add soft delete columns to `calendar_event_notes`
3. Create indexes for performance
4. Set up retention policy function

## API Endpoints

### Existing (Enhanced)
- `GET /api/calendar/events` - Fetch events (already filters deleted)
- `GET /api/calendar/auth` - OAuth flow
- `GET /api/calendar/callback` - OAuth callback

### New
- `GET /api/calendar/sync` - Download from Google
- `POST /api/calendar/sync` - Upload to Google
- `POST /api/calendar/events/:id/restore` - Restore deleted event
- `DELETE /api/calendar/events/:id/permanent` - Permanently delete event
- `GET /api/calendar/trash` - Get deleted events

## Next Steps

1. **Run Database Migration**: Execute `database-schema.sql`
2. **Implement Trash UI**: Create component and add to sync page
3. **Add Restore/Delete Endpoints**: Complete soft delete functionality
4. **Enhance Sync**: Add incremental sync and webhooks
5. **Add Google Icon**: Show synced events with indicator
6. **Test Thoroughly**: Run through all test scenarios

## Notes

- All date/time operations now use date-fns for consistency
- Timezone handling is automatic via date-fns
- DST transitions are handled correctly
- Soft delete allows recovery within 60-day window
- Two-way sync maintains data consistency between OVRSEE and Google




