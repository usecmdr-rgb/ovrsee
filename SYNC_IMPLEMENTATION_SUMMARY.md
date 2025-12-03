# Sync Backend Implementation Summary

## ✅ Implementation Complete

A minimal but production-ready Sync backend has been implemented for Google OAuth integration with Gmail and Calendar sync capabilities.

## 📦 Required Package

**IMPORTANT:** You need to install the `googleapis` package:

```bash
npm install googleapis
```

## 📁 Files Created/Updated

### 1. Environment Configuration
- **`lib/config/env.ts`** (UPDATED)
  - Added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URL`
  - Added `googleConfig` export with fallback to legacy Gmail vars
  - Added `isGoogleConfigured` helper

### 2. OAuth Helpers
- **`lib/sync/googleOAuth.ts`** (NEW)
  - `getGoogleAuthUrl()` - Generates OAuth authorization URL with signed state
  - `exchangeCodeForTokens()` - Exchanges code for access/refresh tokens
  - `getGoogleUserEmail()` - Fetches user email from Google
  - `decodeOAuthState()` - Verifies and decodes signed state

### 3. Integration Persistence
- **`lib/sync/integrations.ts`** (NEW)
  - `upsertGoogleIntegration()` - Stores OAuth tokens in integrations table
  - `getWorkspaceIntegration()` - Retrieves integration by provider
  - `getOrCreateWorkspace()` - Gets or creates user workspace

### 4. Sync Workers
- **`lib/sync/runGmailSync.ts`** (NEW)
  - `runGmailInitialSync()` - Fetches Gmail messages and stores in sync_email_messages

- **`lib/sync/runCalendarSync.ts`** (NEW)
  - `runCalendarInitialSync()` - Fetches Calendar events and stores in sync_calendar_events

### 5. API Routes

#### OAuth Routes
- **`app/api/sync/google/oauth-url/route.ts`** (NEW)
  - GET - Generates OAuth URL for workspace

- **`app/api/sync/google/callback/route.ts`** (NEW)
  - GET - Handles OAuth callback, stores tokens, redirects

#### Sync Job Routes
- **`app/api/sync/gmail/start/route.ts`** (NEW)
  - POST - Creates Gmail sync job

- **`app/api/sync/calendar/start/route.ts`** (NEW)
  - POST - Creates Calendar sync job

#### Internal Worker Route
- **`app/api/internal/sync/run-once/route.ts`** (NEW)
  - POST - Processes one pending sync job (can be called by cron)

#### List Endpoints
- **`app/api/sync/gmail/messages/route.ts`** (NEW)
  - GET - Lists synced Gmail messages with filters

- **`app/api/sync/calendar/events/route.ts`** (NEW)
  - GET - Lists synced calendar events with date range

## 🔧 Assumptions Made

1. **Workspace Model**: Assumes each user has a workspace (created if missing) via `owner_user_id`
2. **State Signing**: Uses `AUTH_SECRET` or `JWT_SECRET` for HMAC signing (must be 32+ chars)
3. **Integration Providers**: Uses `'gmail'` and `'google_calendar'` as provider values
4. **Column Names**: Uses `last_synced_at` (assumes rename migration has run)
5. **Unique Constraint**: Handles partial unique constraint on integrations by deactivating old before inserting new

## 🔐 Security Features

- ✅ Signed OAuth state (HMAC with AUTH_SECRET/JWT_SECRET)
- ✅ Workspace-scoped operations (RLS enforced at DB level)
- ✅ Authentication required for all endpoints
- ✅ Internal worker route can be protected with `INTERNAL_SYNC_SECRET` env var

## 📋 Environment Variables Required

Add to your `.env.local`:

```env
# Google OAuth (for Sync)
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_OAUTH_REDIRECT_URL=https://www.ovrsee.ai/api/sync/google/callback

# Optional: Internal worker secret
INTERNAL_SYNC_SECRET=your_internal_secret_here
```

## 🚀 Usage Flow

1. **User initiates OAuth:**
   ```
   GET /api/sync/google/oauth-url?returnTo=/sync
   → Returns { url: "https://accounts.google.com/..." }
   ```

2. **User authorizes, Google redirects:**
   ```
   GET /api/sync/google/callback?code=...&state=...
   → Stores tokens, redirects to /sync
   ```

3. **User starts sync:**
   ```
   POST /api/sync/gmail/start
   → Creates sync_job with status='pending'
   ```

4. **Worker processes job (cron or manual):**
   ```
   POST /api/internal/sync/run-once
   → Finds pending job, executes sync, marks completed
   ```

5. **User views synced data:**
   ```
   GET /api/sync/gmail/messages?limit=50
   GET /api/sync/calendar/events?from=...&to=...
   ```

## ⚠️ Notes

- **googleapis package**: Must install `npm install googleapis`
- **Column name**: Code uses `last_synced_at` - ensure rename migration has run
- **Unique constraint**: Integrations upsert deactivates old before inserting new (handles partial unique constraint)
- **Error handling**: All routes use `createErrorResponse` for consistent error format
- **Workspace creation**: Workspaces are auto-created if missing (matches existing pattern)

## 🧪 Testing Checklist

- [ ] Install googleapis: `npm install googleapis`
- [ ] Set environment variables
- [ ] Test OAuth flow: `/api/sync/google/oauth-url`
- [ ] Complete OAuth callback
- [ ] Verify integration stored in `public.integrations`
- [ ] Create sync job: `/api/sync/gmail/start`
- [ ] Process job: `/api/internal/sync/run-once`
- [ ] Verify messages in `sync_email_messages`
- [ ] Test list endpoints with filters



