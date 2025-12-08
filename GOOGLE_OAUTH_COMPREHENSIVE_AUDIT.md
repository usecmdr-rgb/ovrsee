# Google OAuth (Gmail + Calendar) Comprehensive Audit

**Date:** January 2025  
**Project:** OVRSEE (Aloha agent)  
**Scope:** Google OAuth implementation for Gmail and Calendar integration

---

## 1. WHERE IS GOOGLE OAUTH IMPLEMENTED?

### OAuth Implementation Files

#### **Core OAuth Library**
- **`lib/sync/googleOAuth.ts`** - Main OAuth helper library
  - `getGoogleAuthUrl()` - Generates OAuth authorization URL
  - `exchangeCodeForTokens()` - Exchanges auth code for tokens
  - `getGoogleUserEmail()` - Fetches user email from Google
  - `decodeOAuthState()` - Verifies and decodes OAuth state
  - State signing/verification using HMAC-SHA256

#### **Unified Sync OAuth Routes (Recommended)**
- **`app/api/sync/google/oauth-url/route.ts`** - GET endpoint to generate OAuth URL
  - Uses unified `GOOGLE_*` environment variables
  - Requests both Gmail and Calendar scopes
  - Stores tokens in `integrations` table
- **`app/api/sync/google/callback/route.ts`** - GET callback handler
  - Exchanges code for tokens
  - Stores integration via `upsertGoogleIntegration()`
  - Redirects to `/sync` or custom `returnTo` path
- **`app/api/sync/google/check-config/route.ts`** - Diagnostic endpoint

#### **Legacy Gmail OAuth Routes (Still Active)**
- **`app/api/gmail/auth/route.ts`** - GET endpoint for Gmail OAuth
  - Uses `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`
  - Stores tokens in `gmail_connections` table
- **`app/api/gmail/callback/route.ts`** - Gmail OAuth callback
- **`app/api/gmail/check-config/route.ts`** - Gmail config check

#### **Legacy Calendar OAuth Routes (Still Active)**
- **`app/api/calendar/auth/route.ts`** - GET endpoint for Calendar OAuth
  - Uses `GOOGLE_CLIENT_ID` or `GMAIL_CLIENT_ID` (fallback)
  - Stores tokens in `calendar_connections` table
- **`app/api/calendar/callback/route.ts`** - Calendar OAuth callback

#### **Integration Persistence**
- **`lib/sync/integrations.ts`** - Database operations
  - `upsertGoogleIntegration()` - Stores tokens in `integrations` table
  - `getWorkspaceIntegration()` - Retrieves integration by provider
  - `getOrCreateWorkspace()` - Workspace management

#### **OAuth Helpers**
- **`lib/oauth-helpers.ts`** - Redirect URI construction
  - `getOAuthRedirectUri()` - Ensures consistent redirect URIs
  - Handles environment-based URL resolution

#### **Configuration**
- **`lib/config/env.ts`** - Environment variable validation
  - `googleConfig` object - Unified Google OAuth config
  - Falls back to legacy `GMAIL_*` vars for backward compatibility

### Gmail-Specific References

#### **Gmail API Calls**
- **`lib/sync/runGmailSync.ts`** - Gmail sync worker
  - Uses `googleapis` library
  - Initializes OAuth2 client with refresh token support
  - Calls `gmail.users.messages.list()` and `gmail.users.messages.get()`
- **`lib/gmail/client.ts`** - Gmail API client wrapper
  - Retrieves tokens from `gmail_connections` table
  - Handles token refresh
- **`lib/gmail/sync.ts`** - Legacy Gmail sync logic
  - Also uses `gmail_connections` table

#### **Gmail Scopes Requested**
- `https://www.googleapis.com/auth/gmail.readonly` (Sync unified route)
- `https://www.googleapis.com/auth/gmail.modify` (Legacy Gmail route)
- Used in: `lib/sync/googleOAuth.ts:85-88`, `app/api/gmail/auth/route.ts:182-185`

### Calendar-Specific References

#### **Calendar API Calls**
- **`lib/sync/runCalendarSync.ts`** - Calendar sync worker
  - Uses `googleapis` library
  - Initializes OAuth2 client with refresh token support
  - Calls `calendar.events.list()` and `calendar.events.get()`
- **`lib/calendar/sync-utils.ts`** - Calendar utility functions
  - Retrieves tokens from `calendar_connections` table

#### **Calendar Scopes Requested**
- `https://www.googleapis.com/auth/calendar.readonly` (Sync unified route)
- `https://www.googleapis.com/auth/calendar` (Legacy Calendar route)
- `https://www.googleapis.com/auth/calendar.events` (Legacy Calendar route)
- Used in: `lib/sync/googleOAuth.ts:85-88`, `app/api/calendar/auth/route.ts:77-80`

### Database Tables

#### **Unified Integration Storage**
- **`public.integrations`** table
  - Stores OAuth tokens for unified Sync route
  - Columns: `access_token`, `refresh_token`, `token_expires_at`, `scopes`, `provider` (gmail/google_calendar)
  - Used by: `app/api/sync/google/callback/route.ts`

#### **Legacy Connection Storage**
- **`public.gmail_connections`** table
  - Stores Gmail OAuth tokens (legacy)
  - Columns: `user_id`, `access_token`, `refresh_token`, `expires_at`, `sync_status`
  - Used by: `app/api/gmail/callback/route.ts`, `lib/gmail/client.ts`
- **`public.calendar_connections`** table
  - Stores Calendar OAuth tokens (legacy)
  - Columns: `user_id`, `access_token`, `refresh_token`, `expires_at`
  - Used by: `app/api/calendar/callback/route.ts`

### Environment Variables

#### **Unified Google OAuth (Recommended)**
- `GOOGLE_CLIENT_ID` - OAuth 2.0 Client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - OAuth 2.0 Client Secret
- `GOOGLE_OAUTH_REDIRECT_URL` - Redirect URI (optional, auto-constructed if not set)
  - Default: `${NEXT_PUBLIC_APP_URL}/api/sync/google/callback`

#### **Legacy Gmail OAuth**
- `GMAIL_CLIENT_ID` - Legacy Gmail Client ID
- `GMAIL_CLIENT_SECRET` - Legacy Gmail Client Secret
- `GMAIL_REDIRECT_URI` - Legacy redirect URI (optional)

#### **Legacy Calendar OAuth**
- `GOOGLE_CALENDAR_CLIENT_ID` - Legacy Calendar Client ID (rarely used)
- `GOOGLE_CALENDAR_CLIENT_SECRET` - Legacy Calendar Client Secret
- `GOOGLE_CALENDAR_REDIRECT_URI` - Legacy redirect URI

#### **Where Environment Variables Are Read**
- **`lib/config/env.ts:97-99`** - Reads `GOOGLE_*` vars
- **`lib/config/env.ts:182-186`** - Creates `googleConfig` object with fallbacks
- **`lib/sync/googleOAuth.ts:71-77`** - Validates config before use
- **`app/api/gmail/auth/route.ts:45-66`** - Reads `GMAIL_*` vars with validation
- **`app/api/calendar/auth/route.ts:6-7`** - Reads `GOOGLE_CLIENT_ID` or `GMAIL_CLIENT_ID`

---

## 2. CURRENT END-TO-END AUTH FLOW

### Unified Sync OAuth Flow (Recommended Path)

#### **Step 1: Initiate OAuth**
- **URL:** `GET /api/sync/google/oauth-url?returnTo=/sync`
- **Location:** User clicks "Connect" button on `/sync` page
- **Implementation:** `app/sync/page.tsx:801-930` → calls `/api/sync/google/oauth-url`
- **Auth Required:** Yes (via `requireAuthFromRequest()`)
- **What Happens:**
  1. Validates user authentication
  2. Gets or creates workspace for user
  3. Calls `getGoogleAuthUrl()` from `lib/sync/googleOAuth.ts`
  4. Signs state containing `workspaceId`, `userId`, `returnTo`
  5. Returns JSON with `url` field containing Google OAuth URL

#### **Step 2: Redirect URI Sent to Google**
- **Redirect URI:** Value from `GOOGLE_OAUTH_REDIRECT_URL` or auto-constructed
  - Default: `${NEXT_PUBLIC_APP_URL}/api/sync/google/callback`
  - Example: `http://localhost:3000/api/sync/google/callback`
- **Where Defined:** `lib/sync/googleOAuth.ts:92`
- **Scopes Requested:**
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/calendar.readonly`
- **OAuth Parameters:**
  - `client_id`: From `GOOGLE_CLIENT_ID`
  - `redirect_uri`: As above
  - `response_type`: `code`
  - `scope`: Gmail + Calendar scopes (space-separated)
  - `access_type`: `offline` (to get refresh token)
  - `prompt`: `consent` (to force consent screen and get refresh token)
  - `state`: Signed state containing workspaceId, userId, returnTo

#### **Step 3: User Authorizes on Google**
- Google shows consent screen
- User grants permissions for Gmail and Calendar
- Google redirects back with authorization code

#### **Step 4: OAuth Callback**
- **URL:** `GET /api/sync/google/callback?code=...&state=...`
- **Implementation:** `app/api/sync/google/callback/route.ts`
- **What Happens:**
  1. Extracts `code` and `state` from query params
  2. Verifies and decodes signed state
  3. Calls `exchangeCodeForTokens(code)` to exchange code for tokens
  4. Calls `getGoogleUserEmail(accessToken)` to get user email
  5. Calls `upsertGoogleIntegration()` to store tokens in `integrations` table
  6. Creates separate rows for Gmail and Calendar (if both scopes granted)
  7. Redirects to `returnTo` from state (default: `/sync`)

### Legacy Gmail OAuth Flow

#### **Step 1: Initiate**
- **URL:** `GET /api/gmail/auth`
- **Location:** `app/sync/page.tsx:846` calls this endpoint
- **Headers:** Requires `Authorization: Bearer <token>` or `x-user-id` header

#### **Step 2: Redirect URI**
- **Redirect URI:** Constructed via `getOAuthRedirectUri()` helper
  - Default: `${NEXT_PUBLIC_APP_URL}/api/gmail/callback`
  - Example: `http://localhost:3000/api/gmail/callback`
- **Scopes:**
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/gmail.modify`

#### **Step 3: Callback**
- **URL:** `GET /api/gmail/callback?code=...&state=...`
- **Implementation:** `app/api/gmail/callback/route.ts`
- **Stores tokens in:** `gmail_connections` table
- **Redirects to:** `/sync?gmail_connected=true`

### Legacy Calendar OAuth Flow

#### **Step 1: Initiate**
- **URL:** `GET /api/calendar/auth`
- **Location:** `app/sync/page.tsx:1094` calls this endpoint

#### **Step 2: Redirect URI**
- **Redirect URI:** `http://localhost:3000/api/calendar/callback` (or production URL)
- **Scopes:**
  - `https://www.googleapis.com/auth/calendar`
  - `https://www.googleapis.com/auth/calendar.events`

#### **Step 3: Callback**
- **URL:** `GET /api/calendar/callback?code=...&state=...`
- **Stores tokens in:** `calendar_connections` table
- **Redirects to:** `/sync?calendar_connected=true&tab=calendar`

---

## 3. COMPARISON WITH OFFICIAL GOOGLE OAUTH 2.0 DOCS

### Official Documentation Reference
- **Link:** https://developers.google.com/identity/protocols/oauth2/web-server
- **Application Type:** Should be "Web application" ✅ (Correct)

### Implementation Compliance

#### ✅ **Correct Practices**
1. **Application Type:** Using "Web application" OAuth client type (verified in comments)
2. **Authorization Endpoint:** Using `https://accounts.google.com/o/oauth2/v2/auth` ✅
3. **Token Exchange Endpoint:** Using `https://oauth2.googleapis.com/token` ✅
4. **State Parameter:** Using signed state with HMAC-SHA256 ✅
5. **Access Type:** Using `access_type=offline` to get refresh tokens ✅
6. **Prompt Parameter:** Using `prompt=consent` to force consent screen ✅
7. **Token Storage:** Storing both access_token and refresh_token ✅

#### ⚠️ **Potential Issues**

1. **Redirect URI Mismatch Risk**
   - **Issue:** Multiple places construct redirect URIs with different logic
   - **Risk:** Redirect URI in code might not match Google Cloud Console exactly
   - **Files Affected:**
     - `lib/sync/googleOAuth.ts` uses `googleConfig.redirectUrl` directly
     - `lib/oauth-helpers.ts` constructs from request headers/origin
   - **Fix Needed:** Ensure exact match in Google Cloud Console

2. **Multiple OAuth Implementations**
   - **Issue:** Three separate OAuth flows (unified Sync, legacy Gmail, legacy Calendar)
   - **Risk:** Different redirect URIs, different token storage locations
   - **Recommendation:** Standardize on unified Sync route

3. **Scope Differences**
   - **Unified Route:** `gmail.readonly` + `calendar.readonly` (read-only)
   - **Legacy Gmail:** `gmail.readonly` + `gmail.modify` (read/write)
   - **Legacy Calendar:** `calendar` + `calendar.events` (full access)
   - **Recommendation:** Align scopes based on actual needs

4. **Missing Error Handling Details**
   - **Issue:** Some callback routes don't log full error responses from Google
   - **File:** `app/api/calendar/callback/route.ts` has minimal error handling
   - **Fix:** Add detailed error logging like Gmail callback

---

## 4. LIKELY REASONS FOR OAUTH ISSUES

### Common OAuth Errors and Their Causes

#### **1. `redirect_uri_mismatch`**
**Symptoms:**
- Google returns: `"error": "redirect_uri_mismatch"`
- OAuth fails immediately after authorization

**Likely Causes:**
- Redirect URI in code doesn't match Google Cloud Console exactly
- Trailing slash mismatch (e.g., `http://localhost:3000/api/sync/google/callback/` vs `/callback`)
- HTTP vs HTTPS mismatch
- Port mismatch in development

**Where to Check:**
- **Unified Route:** `GOOGLE_OAUTH_REDIRECT_URL` or auto-constructed from `NEXT_PUBLIC_APP_URL`
- **Gmail Route:** `GMAIL_REDIRECT_URI` or constructed via `getOAuthRedirectUri()`
- **Diagnostic:** Visit `/api/sync/google/check-config` to see exact redirect URI being used

**Error Logs:**
- `app/api/sync/google/callback/route.ts:72-98` - Logs callback errors
- `app/api/gmail/callback/route.ts:126-163` - Logs token exchange failures

#### **2. `invalid_client`**
**Symptoms:**
- Error: `"error": "invalid_client"`
- Usually happens during token exchange

**Likely Causes:**
- `GOOGLE_CLIENT_ID` doesn't match Google Cloud Console
- `GOOGLE_CLIENT_SECRET` is incorrect
- OAuth client not configured as "Web application"
- Client ID/Secret swapped or wrong project

**Where to Check:**
- `lib/sync/googleOAuth.ts:112-113` - Validates client ID/secret exist
- `app/api/sync/google/check-config/route.ts` - Diagnostic endpoint

**Error Logs:**
- `app/api/gmail/callback/route.ts:150-153` - Handles `invalid_client` specifically
- `lib/sync/googleOAuth.ts:137-139` - Logs token exchange failures

#### **3. `invalid_scope` or Insufficient Permissions**
**Symptoms:**
- Error during authorization: `"error": "invalid_scope"`
- Or: "This app isn't verified" warning

**Likely Causes:**
- Requested scopes not enabled in Google Cloud Console
- OAuth consent screen not configured
- App in testing mode but user not added as test user
- Gmail API or Calendar API not enabled in project

**Where to Check:**
- Scopes defined in:
  - `lib/sync/googleOAuth.ts:85-88` (unified route)
  - `app/api/gmail/auth/route.ts:182-185` (Gmail route)
  - `app/api/calendar/auth/route.ts:77-80` (Calendar route)

#### **4. "App Not Configured" / Consent Screen Issues**
**Symptoms:**
- User sees: "This app isn't verified"
- Cannot proceed past consent screen

**Likely Causes:**
- OAuth consent screen not published
- App in testing mode but user email not added to test users
- Missing required scopes in consent screen configuration

**How to Fix:**
1. Go to Google Cloud Console → APIs & Services → OAuth consent screen
2. Add test users if app is in testing mode
3. Publish app (if ready for production)
4. Ensure Gmail API and Calendar API are enabled

#### **5. Missing Refresh Token**
**Symptoms:**
- OAuth succeeds but `refresh_token` is `null`
- Tokens expire and cannot be refreshed

**Likely Causes:**
- User already granted access before (Google doesn't re-issue refresh tokens)
- Missing `access_type=offline` parameter
- Missing `prompt=consent` parameter

**Current Implementation:**
- ✅ Both routes include `access_type=offline` and `prompt=consent`
- **File:** `lib/sync/googleOAuth.ts:95-96`
- **File:** `app/api/gmail/auth/route.ts:192-193`

### Error Logging Locations

#### **Unified Sync Route**
- **`app/api/sync/google/callback/route.ts:72-98`**
  ```typescript
  console.error("Error in Google OAuth callback:", error);
  ```
- **`lib/sync/googleOAuth.ts:137-139`**
  ```typescript
  const error = await response.text();
  throw new Error(`Failed to exchange code for tokens: ${error}`);
  ```

#### **Gmail Route**
- **`app/api/gmail/callback/route.ts:126-148`**
  ```typescript
  console.error("[Gmail OAuth Callback] Token exchange failed:", errorData);
  // Detailed error logging with error types
  ```

#### **Calendar Route**
- **`app/api/calendar/callback/route.ts:49-54`**
  ```typescript
  console.error("Token exchange failed:", errorData);
  // Minimal logging - needs improvement
  ```

---

## 5. PROPOSED FIXES

### Fix 1: Standardize Redirect URI Construction

#### **Current Issue**
Redirect URIs are constructed differently in different places, risking mismatches.

#### **Recommended Solution**
Use a single source of truth for redirect URI construction.

**File:** `lib/sync/googleOAuth.ts`

**Current Code (lines 75-77):**
```typescript
if (!googleConfig.redirectUrl) {
  throw new Error("GOOGLE_OAUTH_REDIRECT_URL is not configured");
}
```

**Proposed Fix:**
```typescript
// Ensure redirect URL is always explicitly set or construct it consistently
function getRedirectUrl(): string {
  // Priority 1: Explicit env var
  if (googleConfig.redirectUrl) {
    return googleConfig.redirectUrl.replace(/\/$/, ""); // Remove trailing slash
  }
  
  // Priority 2: Construct from NEXT_PUBLIC_APP_URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/api/sync/google/callback`;
}
```

### Fix 2: Ensure Exact Redirect URI Match

#### **What to Register in Google Cloud Console**

**For Development:**
```
http://localhost:3000/api/sync/google/callback
```

**For Production:**
```
https://ovrsee.ai/api/sync/google/callback
```

**Important:** 
- No trailing slashes
- Exact match (case-sensitive for protocol)
- Register BOTH development and production URIs

### Fix 3: Minimal Working Code Changes

#### **A. Get Access Token + Refresh Token**

**Already implemented correctly:**
- ✅ `access_type=offline` is set
- ✅ `prompt=consent` is set
- ✅ Refresh token is stored in database

**Verification:** Check `lib/sync/googleOAuth.ts:144-147`:
```typescript
return {
  accessToken: data.access_token,
  refreshToken: data.refresh_token,  // ✅ Stored
  expiresAt: data.expires_in ? ... : null,
  scope: data.scope ? data.scope.split(" ") : [],
};
```

#### **B. Store Tokens Safely**

**Current Implementation:** ✅ Good
- Tokens stored in `integrations` table
- Uses `upsertGoogleIntegration()` function
- Separate rows for Gmail and Calendar
- **File:** `lib/sync/integrations.ts:22-132`

**Security Note:**
- Tokens stored in database (encrypted at rest by Supabase)
- Access controlled via RLS policies
- Refresh tokens used for automatic token renewal

#### **C. Ready to Call Gmail and Calendar APIs**

**Already Implemented:**
- ✅ OAuth2 client initialization: `lib/sync/runGmailSync.ts:49-57`
- ✅ Automatic token refresh: `lib/sync/runGmailSync.ts:60-76`
- ✅ API calls: `lib/sync/runGmailSync.ts:82` (Gmail), `lib/sync/runCalendarSync.ts:82` (Calendar)

**Example Usage:**
```typescript
// From lib/sync/runGmailSync.ts
const oauth2Client = new google.auth.OAuth2(
  googleConfig.clientId,
  googleConfig.clientSecret,
  googleConfig.redirectUrl
);
oauth2Client.setCredentials({
  access_token: integration.access_token,
  refresh_token: integration.refresh_token || undefined,
});

// Automatically refreshes if expired
await oauth2Client.refreshAccessToken();

const gmail = google.gmail({ version: "v1", auth: oauth2Client });
// Ready to make API calls
```

### Fix 4: Enhanced Error Logging

**File:** `app/api/sync/google/callback/route.ts`

**Add after line 48:**
```typescript
// Exchange code for tokens
let tokens;
try {
  tokens = await exchangeCodeForTokens(code);
} catch (error: any) {
  console.error("[OAuth Callback] Token exchange failed:", {
    error: error.message,
    codeLength: code?.length,
    stateLength: stateParam?.length,
    redirectUrl: googleConfig.redirectUrl,
    clientIdPrefix: googleConfig.clientId?.substring(0, 20),
  });
  throw error;
}
```

### Fix 5: Configuration Validation Script

**Create:** `scripts/verify-google-oauth-setup.js`

```javascript
const { googleConfig } = require('../lib/config/env');

console.log('Google OAuth Configuration Check:');
console.log('================================');
console.log('Client ID:', googleConfig.clientId ? `${googleConfig.clientId.substring(0, 20)}...` : 'NOT SET');
console.log('Client Secret:', googleConfig.clientSecret ? 'SET' : 'NOT SET');
console.log('Redirect URL:', googleConfig.redirectUrl || 'NOT SET (will be auto-constructed)');

const issues = [];
if (!googleConfig.clientId) issues.push('GOOGLE_CLIENT_ID is not set');
if (!googleConfig.clientSecret) issues.push('GOOGLE_CLIENT_SECRET is not set');

if (issues.length > 0) {
  console.log('\n❌ Issues found:');
  issues.forEach(issue => console.log(`  - ${issue}`));
} else {
  console.log('\n✅ Configuration looks good!');
  console.log('\nNext steps:');
  console.log('1. Verify redirect URI in Google Cloud Console:');
  console.log(`   ${googleConfig.redirectUrl || 'http://localhost:3000/api/sync/google/callback'}`);
  console.log('2. Ensure Gmail API and Calendar API are enabled');
  console.log('3. Add test users to OAuth consent screen (if in testing mode)');
}
```

---

## 6. SMOKE TEST GUIDE

### Step-by-Step Testing Process

#### **Step 1: Check Configuration**
**URL:** `http://localhost:3000/api/sync/google/check-config`

**Expected Response:**
```json
{
  "configured": true,
  "issues": [],
  "config": {
    "clientId": "123456789012-abc...",
    "clientSecret": "***SET***",
    "redirectUrl": "http://localhost:3000/api/sync/google/callback",
    "hasClientId": true,
    "hasClientSecret": true,
    "hasRedirectUrl": true,
    "isConfigured": true
  }
}
```

**If not configured:**
- Add missing env vars to `.env.local`
- Restart dev server
- Re-check configuration

#### **Step 2: Start OAuth Flow**
**URL:** `http://localhost:3000/api/sync/google/oauth-url?returnTo=/sync`

**Prerequisites:**
- Must be authenticated (logged in)
- Include session cookie or Bearer token

**Command:**
```bash
# Get session cookie from browser dev tools, then:
curl -H "Cookie: YOUR_SESSION_COOKIE" \
  "http://localhost:3000/api/sync/google/oauth-url?returnTo=/sync"
```

**Expected Response:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=http://localhost:3000/api/sync/google/callback&response_type=code&scope=https://www.googleapis.com/auth/gmail.readonly+https://www.googleapis.com/auth/calendar.readonly&access_type=offline&prompt=consent&state=..."
}
```

**Or from Browser:**
1. Navigate to `/sync` page
2. Click "Connect Gmail" or "Connect Calendar" button
3. Should redirect to Google OAuth consent screen

#### **Step 3: Authorize on Google**
**Expected Behavior:**
1. Redirected to Google OAuth consent screen
2. Shows requested permissions (Gmail read, Calendar read)
3. If app is in testing mode, user email must be in test users list
4. Click "Allow" or "Continue"

**What to Verify:**
- ✅ Redirect URI shown matches: `http://localhost:3000/api/sync/google/callback`
- ✅ Scopes shown match: Gmail read + Calendar read
- ✅ No "redirect_uri_mismatch" error

#### **Step 4: Handle Callback**
**Expected Behavior:**
1. Google redirects to: `http://localhost:3000/api/sync/google/callback?code=...&state=...`
2. Backend exchanges code for tokens
3. Tokens stored in `integrations` table
4. Redirects to `/sync?gmail_connected=true` (or custom `returnTo`)

**Check Server Logs:**
```
[OAuth Callback] Exchanging code for tokens
[OAuth Callback] Tokens received successfully
  - Has access token: true
  - Has refresh token: true
  - Expires in: 3600 seconds
```

#### **Step 5: Verify Token Storage**

**Check Database:**
```sql
SELECT 
  id,
  workspace_id,
  provider,
  is_active,
  token_expires_at,
  scopes,
  metadata->>'email' as email,
  created_at
FROM integrations
WHERE provider IN ('gmail', 'google_calendar')
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:**
- Two rows (one for `gmail`, one for `google_calendar`)
- `is_active = true`
- `access_token` and `refresh_token` populated (not shown in query above)
- `scopes` array contains Gmail/Calendar scopes
- `metadata.email` contains user's email

#### **Step 6: Test API Calls**

**Test Gmail API:**
```bash
# Call sync endpoint (should use stored tokens)
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/sync/gmail/start
```

**Test Calendar API:**
```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/sync/calendar/events"
```

### Debugging: Log Key Information

#### **Add Temporary Debug Logs**

**File:** `app/api/sync/google/callback/route.ts`

**Add after line 48 (token exchange):**
```typescript
// TEMPORARY DEBUG LOGS - Remove after testing
console.log("=== OAUTH CALLBACK DEBUG ===");
console.log("Code received:", code ? `${code.substring(0, 20)}...` : "MISSING");
console.log("State received:", stateParam ? `${stateParam.substring(0, 50)}...` : "MISSING");
console.log("Redirect URL being used:", googleConfig.redirectUrl);
console.log("Client ID (prefix):", googleConfig.clientId?.substring(0, 20));

const tokens = await exchangeCodeForTokens(code);

console.log("Tokens received:");
console.log("  - Access token:", tokens.accessToken ? `${tokens.accessToken.substring(0, 20)}...` : "MISSING");
console.log("  - Refresh token:", tokens.refreshToken ? `${tokens.refreshToken.substring(0, 20)}...` : "MISSING");
console.log("  - Expires at:", tokens.expiresAt);
console.log("  - Scopes:", tokens.scope);
console.log("============================");
```

**Add after line 51 (email fetch):**
```typescript
const email = await getGoogleUserEmail(tokens.accessToken);
console.log("Google user email:", email);
```

**Add after line 54 (database storage):**
```typescript
await upsertGoogleIntegration({...});

console.log("Integration stored successfully");
console.log("  - Workspace ID:", state.workspaceId);
console.log("  - User ID:", state.userId);
```

#### **Remove Debug Logs After Testing**
Once OAuth flow is working, remove all `console.log` statements added for debugging.

---

## SUMMARY & RECOMMENDATIONS

### Current State
- ✅ **Multiple OAuth implementations** (unified Sync route + legacy Gmail/Calendar routes)
- ✅ **Proper token storage** in database with refresh token support
- ✅ **State signing** for security
- ⚠️ **Redirect URI consistency** needs attention
- ⚠️ **Error logging** could be more detailed in some places

### Recommended Actions

1. **Standardize on Unified Route**
   - Use `/api/sync/google/oauth-url` and `/api/sync/google/callback` for all new integrations
   - Migrate legacy Gmail/Calendar routes to use unified approach
   - Consolidate token storage in `integrations` table

2. **Fix Redirect URI Matching**
   - Register exact redirect URIs in Google Cloud Console
   - Use consistent redirect URI construction logic
   - Add validation to ensure match before OAuth flow starts

3. **Improve Error Handling**
   - Add detailed error logging in Calendar callback
   - Surface user-friendly error messages
   - Add retry logic for transient failures

4. **Documentation**
   - Document exact redirect URIs for each environment
   - Create setup checklist for Google Cloud Console
   - Add troubleshooting guide for common errors

### Critical Configuration Checklist

**Google Cloud Console:**
- [ ] OAuth 2.0 Client ID created (type: "Web application")
- [ ] Authorized redirect URIs added (development + production)
- [ ] Gmail API enabled
- [ ] Calendar API enabled
- [ ] OAuth consent screen configured
- [ ] Test users added (if app in testing mode)

**Environment Variables:**
- [ ] `GOOGLE_CLIENT_ID` set
- [ ] `GOOGLE_CLIENT_SECRET` set
- [ ] `GOOGLE_OAUTH_REDIRECT_URL` set (or `NEXT_PUBLIC_APP_URL` set for auto-construction)
- [ ] `AUTH_SECRET` or `JWT_SECRET` set (for state signing)

**Database:**
- [ ] `integrations` table exists and has correct schema
- [ ] RLS policies allow users to access their own integrations

---

**End of Audit**


