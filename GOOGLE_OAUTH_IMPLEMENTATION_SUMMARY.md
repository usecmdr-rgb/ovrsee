# Google OAuth Implementation Summary

**Date:** January 2025  
**Changes:** Standardized on unified Google OAuth flow with fixes for scopes, refresh tokens, and configuration

---

## Files Changed

### 1. Core OAuth Library
**File:** `lib/sync/googleOAuth.ts`
- ✅ **Updated scopes:** Changed from `gmail.readonly` + `calendar.readonly` to:
  - `gmail.readonly` (read emails)
  - `gmail.send` (send emails)
  - `calendar` (full calendar access - read/write events)
- ✅ **Exported scopes constant:** `GOOGLE_OAUTH_SCOPES` for easy updates
- ✅ **Fixed refresh token handling:** Return `null` instead of `undefined` when Google doesn't provide refresh token
- ✅ **Improved redirect URL handling:** Support getter function for auto-construction

### 2. Integration Persistence
**File:** `lib/sync/integrations.ts`
- ✅ **Added type definitions:** `GoogleIntegration` interface documenting the shape of stored integrations
- ✅ **Fixed refresh token preservation:** Added `preserveRefreshToken` parameter to prevent overwriting existing refresh tokens with `null`
- ✅ **Updated callback integration:** Now preserves existing refresh tokens when Google doesn't return a new one

### 3. OAuth Callback Handler
**File:** `app/api/sync/google/callback/route.ts`
- ✅ **Updated refresh token handling:** Passes `preserveRefreshToken: true` to integration upsert
- ✅ **Better error handling:** Improved error messages and logging

### 4. Configuration Check Endpoint
**File:** `app/api/sync/google/check-config/route.ts`
- ✅ **Enhanced validation:** Checks redirect URI matches expected dev/prod values
- ✅ **Environment-aware redirect URI validation:** Verifies `http://localhost:3000/api/sync/google/callback` (dev) or `https://ovrsee.ai/api/sync/google/callback` (prod)
- ✅ **Better error messages:** Includes specific instructions for fixing configuration issues
- ✅ **Shows requested scopes:** Displays all scopes being requested in OAuth flow

### 5. Environment Configuration
**File:** `lib/config/env.ts`
- ✅ **Auto-construct redirect URL:** Getter function automatically builds redirect URI based on environment:
  - Dev: `http://localhost:3000/api/sync/google/callback`
  - Prod: `https://ovrsee.ai/api/sync/google/callback`
- ✅ **Fallback support:** Still supports explicit `GOOGLE_OAUTH_REDIRECT_URL` or legacy `GMAIL_REDIRECT_URI`

### 6. Dev Test Endpoint (NEW)
**File:** `app/api/sync/google/dev-test/route.ts`
- ✅ **Created new endpoint:** `/api/sync/google/dev-test`
- ✅ **Tests Gmail API:** Lists first 5 messages (IDs and subjects)
- ✅ **Tests Calendar API:** Lists next 5 upcoming events (summaries and start times)
- ✅ **Returns integration status:** Shows token status, scopes, expiry for both Gmail and Calendar
- ✅ **Development-only:** Gated behind `NODE_ENV !== 'production'` check
- ✅ **Requires authentication:** Uses `requireAuthFromRequest()` helper

### 7. Legacy Route Deprecation
**Files:** 
- `app/api/gmail/auth/route.ts`
- `app/api/calendar/auth/route.ts`
- ✅ **Added deprecation warnings:** Both routes now return `410 Gone` with migration instructions
- ✅ **Migration guidance:** Error response includes link to unified route and documentation
- ✅ **Legacy code preserved:** Old implementation kept as comments for reference

### 8. Frontend Integration
**File:** `app/sync/page.tsx`
- ✅ **Refactored `handleConnectGmail()`:** Now uses `/api/sync/google/oauth-url` instead of `/api/gmail/auth`
- ✅ **Refactored `handleConnectCalendar()`:** Delegates to unified flow (connects both Gmail and Calendar)
- ✅ **Updated error handling:** Shows unified configuration errors
- ✅ **Better user messages:** Explains that connecting Gmail also connects Calendar

---

## How to Use

### 1. Start OAuth Flow in Dev

**Option A: Via Frontend**
1. Navigate to `/sync` page
2. Click "Connect Gmail" button
3. This initiates the unified OAuth flow

**Option B: Via API (for testing)**
```bash
# Must be authenticated (include session cookie)
curl -H "Cookie: YOUR_SESSION_COOKIE" \
  "http://localhost:3000/api/sync/google/oauth-url?returnTo=/sync"
```

**Expected Response:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=http://localhost:3000/api/sync/google/callback&response_type=code&scope=https://www.googleapis.com/auth/gmail.readonly+https://www.googleapis.com/auth/gmail.send+https://www.googleapis.com/auth/calendar&access_type=offline&prompt=consent&state=..."
}
```

### 2. Complete Consent

1. Browser redirects to Google OAuth consent screen
2. User sees requested permissions:
   - Read Gmail messages
   - Send email on your behalf
   - Manage your calendars
3. User clicks "Allow" or "Continue"
4. Google redirects to: `http://localhost:3000/api/sync/google/callback?code=...&state=...`
5. Backend exchanges code for tokens
6. Tokens stored in `integrations` table (separate rows for Gmail and Calendar)
7. User redirected back to `/sync?gmail_connected=true`

### 3. Run Dev Test Route

```bash
# Must be authenticated and have connected Google services
curl -H "Cookie: YOUR_SESSION_COOKIE" \
  "http://localhost:3000/api/sync/google/dev-test"
```

**Expected Response:**
```json
{
  "ok": true,
  "timestamp": "2025-01-XX...",
  "workspace": {
    "id": "...",
    "ownerUserId": "..."
  },
  "integrations": {
    "gmail": {
      "found": true,
      "hasAccessToken": true,
      "hasRefreshToken": true,
      "expiresAt": "2025-01-XX...",
      "scopes": ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"]
    },
    "calendar": {
      "found": true,
      "hasAccessToken": true,
      "hasRefreshToken": true,
      "expiresAt": "2025-01-XX...",
      "scopes": ["https://www.googleapis.com/auth/calendar"]
    }
  },
  "testResults": {
    "gmail": {
      "success": true,
      "error": null,
      "messagesCount": 5,
      "messages": [
        {
          "id": "...",
          "subject": "Example email",
          "from": "sender@example.com",
          "snippet": "..."
        }
      ]
    },
    "calendar": {
      "success": true,
      "error": null,
      "eventsCount": 3,
      "events": [
        {
          "id": "...",
          "summary": "Meeting",
          "start": "2025-01-XX...",
          "end": "2025-01-XX...",
          "location": "Conference Room"
        }
      ]
    }
  }
}
```

---

## Configuration Requirements

### Environment Variables

**Required:**
```bash
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

**Optional (auto-constructed if not set):**
```bash
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3000/api/sync/google/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Used for auto-construction
```

### Google Cloud Console Setup

1. **Create OAuth 2.0 Client ID:**
   - Type: "Web application"
   - Authorized redirect URIs:
     - Dev: `http://localhost:3000/api/sync/google/callback`
     - Prod: `https://ovrsee.ai/api/sync/google/callback`

2. **Enable APIs:**
   - Gmail API
   - Calendar API

3. **OAuth Consent Screen:**
   - Configure app information
   - Add test users (if app is in testing mode)
   - Approve requested scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/calendar`

---

## Key Improvements

### 1. **Unified OAuth Flow**
- Single OAuth flow connects both Gmail and Calendar
- Consistent token management in `integrations` table
- Better error handling and user feedback

### 2. **Proper Scopes for Aloha**
- Added `gmail.send` for sending emails
- Changed `calendar.readonly` to `calendar` for full calendar access
- All scopes in one constant for easy maintenance

### 3. **Refresh Token Handling**
- Preserves existing refresh tokens when Google doesn't return new ones
- Prevents accidental token loss on re-authorization
- Handles cases where user already granted access

### 4. **Better Configuration Validation**
- Validates redirect URI matches expected values
- Environment-aware checks (dev vs prod)
- Clear error messages with setup instructions

### 5. **Developer Tooling**
- Dev test endpoint for end-to-end verification
- Detailed integration status in test results
- Easy debugging of OAuth issues

---

## Migration Notes

### For Existing Code Using Legacy Routes

**Before:**
```typescript
// Legacy Gmail route
fetch("/api/gmail/auth", { ... })
fetch("/api/calendar/auth", { ... })
```

**After:**
```typescript
// Unified route (connects both)
fetch("/api/sync/google/oauth-url?returnTo=/sync", { ... })
```

### For Code Using Legacy Tables

**Note:** Legacy tables (`gmail_connections`, `calendar_connections`) are still supported for existing integrations. However:
- ✅ New OAuth flows use `integrations` table only
- ⚠️ Legacy table reads are still supported (not migrated in this change)
- 📝 Future migration: Refactor code reading from legacy tables to use `integrations` table

---

## Testing Checklist

- [ ] Environment variables set (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- [ ] Redirect URI registered in Google Cloud Console
- [ ] Gmail API and Calendar API enabled
- [ ] OAuth consent screen configured
- [ ] Test user added (if app is in testing mode)
- [ ] Start OAuth flow: `/sync` page → "Connect Gmail"
- [ ] Complete consent on Google
- [ ] Verify tokens stored in `integrations` table
- [ ] Run dev test: `/api/sync/google/dev-test`
- [ ] Verify Gmail API calls work (list messages)
- [ ] Verify Calendar API calls work (list events)

---

## Next Steps

1. **Monitor OAuth flows:** Watch for any errors in production
2. **Migrate legacy table reads:** Refactor code using `gmail_connections`/`calendar_connections` to use `integrations` table
3. **Remove legacy routes:** After confirming no code uses them, remove deprecated endpoints
4. **Update documentation:** Update setup guides to reference unified flow

---

**End of Implementation Summary**


