# OAuth Environment Variables - Complete List

## ✅ Required Variables for Google OAuth

### 1. **GOOGLE_CLIENT_ID** (Required)
- **Format:** `xxxxx-xxxxx.apps.googleusercontent.com`
- **Where to get:** Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID
- **Example:** `1077385431224-vn2b4p0jl1gqs1gm7eubj0egephtt610.apps.googleusercontent.com`
- **Purpose:** Identifies your OAuth application to Google

### 2. **GOOGLE_CLIENT_SECRET** (Required)
- **Format:** `GOCSPX-xxxxx` (new format) or `xxxxx` (old format)
- **Where to get:** Same place as Client ID (shown only once when created)
- **Example:** `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`
- **Purpose:** Authenticates your application when exchanging authorization code for tokens

### 3. **AUTH_SECRET** or **JWT_SECRET** (Required for OAuth state signing)
- **Format:** At least 32 characters (hex string recommended)
- **Where to get:** Generate yourself (random secure string)
- **Example:** `b7e48577d2112d819d737e5753a59aec91583557d759fe58a89ea4192208afcb`
- **Purpose:** Signs OAuth state parameter to prevent CSRF attacks
- **Note:** Either `AUTH_SECRET` OR `JWT_SECRET` is required (AUTH_SECRET takes precedence)

## 🔧 Optional Variables (Auto-configured if not set)

### 4. **GOOGLE_OAUTH_REDIRECT_URL** (Optional)
- **Format:** Full URL including protocol and path
- **Default:** Auto-constructed from `NEXT_PUBLIC_APP_URL`
- **Example:** `http://localhost:3000/api/sync/google/callback`
- **Purpose:** Where Google redirects after user authorization
- **Auto-construction:**
  - Dev: `http://localhost:3000/api/sync/google/callback`
  - Prod: `https://ovrsee.ai/api/sync/google/callback`

### 5. **NEXT_PUBLIC_APP_URL** (Optional, but recommended)
- **Format:** Base URL of your application
- **Example:** `http://localhost:3000` (dev) or `https://ovrsee.ai` (prod)
- **Purpose:** Used to auto-construct redirect URI if `GOOGLE_OAUTH_REDIRECT_URL` not set

## ❌ NOT Required

### **GOOGLE_PROJECT_ID** (NOT needed)
- **Why:** The Client ID already contains the project information
- **Note:** Google OAuth doesn't require project ID as a separate variable
- The Client ID format `xxxxx-xxxxx.apps.googleusercontent.com` already includes project info

## 📋 Complete .env.local Example

```bash
# ============================================================================
# Google OAuth Configuration (Required)
# ============================================================================

# OAuth Client ID (from Google Cloud Console)
GOOGLE_CLIENT_ID=1077385431224-vn2b4p0jl1gqs1gm7eubj0egephtt610.apps.googleusercontent.com

# OAuth Client Secret (from Google Cloud Console - shown only once!)
GOOGLE_CLIENT_SECRET=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

# OAuth Redirect URI (optional - auto-constructed if not set)
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3000/api/sync/google/callback

# OAuth State Signing Secret (required - must be at least 32 characters)
AUTH_SECRET=b7e48577d2112d819d737e5753a59aec91583557d759fe58a89ea4192208afcb

# JWT Secret (optional fallback for AUTH_SECRET)
JWT_SECRET=b7e48577d2112d819d737e5753a59aec91583557d759fe58a89ea4192208afcb

# App URL (optional - used for auto-constructing redirect URI)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🔍 Verification Checklist

Run this to check your configuration:
```bash
node scripts/verify-google-oauth.js
```

Or check manually:
- ✅ `GOOGLE_CLIENT_ID` is set and format is correct
- ✅ `GOOGLE_CLIENT_SECRET` is set
- ✅ `AUTH_SECRET` or `JWT_SECRET` is set (at least 32 characters)
- ✅ `GOOGLE_OAUTH_REDIRECT_URL` matches what's in Google Cloud Console

## 🚫 Common Mistakes

1. **Missing AUTH_SECRET/JWT_SECRET**
   - Error: "AUTH_SECRET or JWT_SECRET must be at least 32 characters"
   - Fix: Add AUTH_SECRET with at least 32 characters

2. **Wrong Client ID format**
   - Error: "OAuth client was not found"
   - Fix: Verify Client ID matches exactly from Google Cloud Console

3. **Redirect URI mismatch**
   - Error: "OAuth client was not found" or "redirect_uri_mismatch"
   - Fix: Ensure redirect URI in .env.local matches Google Cloud Console exactly

4. **Trying to use Project ID**
   - Not needed! Client ID already contains project information

## 📝 Summary

**Minimum Required:**
1. `GOOGLE_CLIENT_ID`
2. `GOOGLE_CLIENT_SECRET`
3. `AUTH_SECRET` (or `JWT_SECRET`)

**Optional but Recommended:**
4. `GOOGLE_OAUTH_REDIRECT_URL` (auto-constructed if not set)
5. `NEXT_PUBLIC_APP_URL` (for auto-constructing redirect URI)

**NOT Needed:**
- ❌ `GOOGLE_PROJECT_ID` (not required for OAuth)


