# Business Info Save Failure - Comprehensive Audit Report

**Date:** 2025-01-22  
**Status:** Diagnosis Only - No Code Changes  
**Purpose:** Identify root causes of business info save failures

---

## Executive Summary

The business info save functionality is failing due to **critical schema conflicts** between two different migration files that define incompatible `business_profiles` table structures. Additionally, there are field name mismatches, potential NOT NULL constraint violations, and a disconnect between the UI payload and database expectations.

**Top 3 Most Likely Root Causes:**
1. **Schema Conflict:** Two migrations define different `business_profiles` schemas with conflicting column names
2. **Missing Required Field:** New schema requires `business_name NOT NULL`, but UI may send empty string
3. **Column Name Mismatch:** API writes to `primary_website_url` but new schema uses `website_url`

---

## 1. Business Data Model

### 1.1 Tables Identified

#### Primary Table: `business_profiles`
**Location:** Defined in multiple migrations (see conflict below)

**Schema Conflict - CRITICAL ISSUE:**

**Schema A (Old - from `20241129000000_business_profile_knowledge.sql`):**
- `id` UUID PRIMARY KEY
- `user_id` UUID NOT NULL (FK to auth.users)
- `business_name` TEXT (nullable)
- `business_type` TEXT
- `description` TEXT
- `primary_website_url` TEXT
- `additional_urls` JSONB
- `location` TEXT
- `service_area` TEXT
- `contact_email` TEXT
- `contact_phone` TEXT
- `services_offered` JSONB
- `hours_of_operation` TEXT
- `service_name` TEXT
- `image_watermark_enabled` BOOLEAN
- `image_watermark_text` TEXT
- `image_watermark_logo_url` TEXT
- `image_watermark_position` TEXT
- `preferences` JSONB
- `language` TEXT DEFAULT 'English'
- `timezone` TEXT DEFAULT 'EST'
- `notes` TEXT
- `last_crawled_at` TIMESTAMP
- `crawl_status` TEXT
- `crawl_error` TEXT
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP
- UNIQUE(user_id)

**Schema B (New - from `20250124000000_business_info_schema.sql`):**
- `id` UUID PRIMARY KEY
- `user_id` UUID NOT NULL (FK to auth.users)
- `business_name` TEXT **NOT NULL** ⚠️
- `website_url` TEXT (NOT `primary_website_url`)
- `description` TEXT
- `default_currency` TEXT DEFAULT 'USD'
- `brand_voice` TEXT CHECK (IN ('formal', 'friendly', 'casual_professional', 'professional', 'casual'))
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP
- UNIQUE(user_id)

**Missing in Schema B:** business_type, full_name, contact_email, contact_phone, services_offered, hours_of_operation, service_name, location, service_area, language, timezone, notes, and all watermark/preference fields.

#### Related Tables (from Schema B migration):

1. **`business_services`**
   - `id` UUID PRIMARY KEY
   - `business_id` UUID (FK to business_profiles)
   - `name` TEXT NOT NULL
   - `description` TEXT
   - `category` TEXT
   - `is_active` BOOLEAN DEFAULT true
   - `created_at`, `updated_at` TIMESTAMP

2. **`business_pricing_tiers`**
   - `id` UUID PRIMARY KEY
   - `business_id` UUID (FK to business_profiles)
   - `service_id` UUID (FK to business_services, nullable)
   - `name` TEXT NOT NULL
   - `description` TEXT
   - `price_amount` NUMERIC(10, 2) NOT NULL
   - `price_currency` TEXT DEFAULT 'USD'
   - `billing_interval` TEXT CHECK (IN ('one_time', 'monthly', 'yearly', 'hourly', 'daily', 'weekly'))
   - `is_default` BOOLEAN DEFAULT false
   - `is_active` BOOLEAN DEFAULT true
   - `created_at`, `updated_at` TIMESTAMP

3. **`business_hours`**
   - `id` UUID PRIMARY KEY
   - `business_id` UUID (FK to business_profiles)
   - `day_of_week` INTEGER (0-6, Sunday-Saturday)
   - `open_time` TIME
   - `close_time` TIME
   - `timezone` TEXT DEFAULT 'America/New_York'
   - `is_closed` BOOLEAN DEFAULT false
   - `created_at`, `updated_at` TIMESTAMP
   - UNIQUE(business_id, day_of_week)

4. **`business_faqs`**
   - `id` UUID PRIMARY KEY
   - `business_id` UUID (FK to business_profiles)
   - `question` TEXT NOT NULL
   - `answer` TEXT NOT NULL
   - `created_at`, `updated_at` TIMESTAMP

5. **`business_website_snapshots`**
   - `id` UUID PRIMARY KEY
   - `business_id` UUID (FK to business_profiles)
   - `snapshot_type` TEXT CHECK (IN ('homepage', 'pricing', 'services', 'about', 'contact', 'other'))
   - `content_text` TEXT NOT NULL
   - `created_at`, `updated_at` TIMESTAMP

6. **`business_knowledge_chunks`** (from Schema A migration)
   - `id` UUID PRIMARY KEY
   - `business_profile_id` UUID (FK to business_profiles)
   - `source` TEXT CHECK (IN ('form', 'website', 'manual'))
   - `source_url` TEXT
   - `title` TEXT
   - `content` TEXT NOT NULL
   - `embedding` vector(1536) (optional)
   - `metadata` JSONB
   - `created_at`, `updated_at` TIMESTAMP

### 1.2 Migration Files

1. `supabase/migrations/20241129000000_business_profile_knowledge.sql` - Creates Schema A
2. `supabase/migrations/20250122000003_add_business_type_column.sql` - Adds business_type to Schema A
3. `supabase/migrations/20250122000004_add_full_name_to_business_profiles.sql` - Adds full_name to Schema A
4. `supabase/migrations/20250122000005_add_missing_business_profile_columns.sql` - Adds missing columns to Schema A
5. `supabase/migrations/20250124000000_business_info_schema.sql` - Creates Schema B (CONFLICTS with Schema A)

### 1.3 Consistency Issues

- **CRITICAL:** Two completely different table definitions exist
- **CRITICAL:** Column name mismatch: `primary_website_url` (Schema A) vs `website_url` (Schema B)
- **CRITICAL:** Schema B requires `business_name NOT NULL`, but UI may send empty string
- Schema B is missing many fields that the API route and UI expect (business_type, full_name, contact_email, etc.)
- Schema B introduces new tables (business_services, business_pricing_tiers, etc.) that are not used by the current API route

---

## 2. Business Info Save Pipeline

### 2.1 API Route: `POST /api/business-profile`

**File:** `app/api/business-profile/route.ts`

**Flow:**
1. **Authentication:** Uses `requireAuthFromRequest(request)` to get user
2. **Client:** Uses `getSupabaseServerClient()` - **BYPASSES RLS** (service role key)
3. **Payload Mapping:** Maps UI fields to database columns:
   ```typescript
   {
     user_id: user.id,
     full_name: body.fullName || null,
     business_name: body.businessName || null,  // ⚠️ May be empty string
     business_type: body.businessType || null,
     description: body.description || null,
     primary_website_url: body.website || null,  // ⚠️ Column name mismatch
     location: body.location || null,
     service_area: body.serviceArea || null,
     contact_email: body.contactEmail || null,
     contact_phone: body.contactPhone || null,
     services_offered: body.services || null,
     hours_of_operation: body.operatingHours || null,
     service_name: body.serviceName || null,
     language: body.language || "English",
     timezone: body.timezone || "EST",
     notes: body.notes || null,
   }
   ```
4. **Upsert Logic:**
   - Checks if profile exists by `user_id`
   - If exists: UPDATE
   - If not: INSERT
5. **Knowledge Chunks:** Also creates/updates `business_knowledge_chunks` with form data
6. **Website Crawl:** Triggers async website crawl if URL changed

**Expected Payload (from UI):**
```typescript
{
  fullName?: string;
  businessName: string;  // ⚠️ May be empty string
  businessType?: string;
  location?: string;
  operatingHours?: string;
  serviceName?: string;
  services?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  language?: string;
  timezone?: string;
  notes?: string;
}
```

### 2.2 Potential Failure Points

1. **NOT NULL Constraint Violation:**
   - If Schema B is active, `business_name NOT NULL` will fail if `body.businessName` is empty string or null
   - API converts empty to `null`, but if Schema B is active, this violates NOT NULL

2. **Column Not Found (PGRST204):**
   - If Schema B is active, columns like `primary_website_url`, `business_type`, `full_name`, `contact_email`, etc. don't exist
   - API will fail with "column does not exist" error

3. **RLS Bypass:**
   - Using service role client bypasses RLS, so RLS policies are not the issue
   - However, if RLS was intended to be enforced, this is a security concern

4. **Error Handling:**
   - Errors are logged to console but may not be properly surfaced to UI
   - Line 100-103: `console.error` but error is thrown, which should be caught by try/catch
   - Line 171-176: Catches errors and returns 500, but error message may not be user-friendly

---

## 3. Business Info UI & Form Flow

### 3.1 UI Component: `BusinessInfoModal`

**File:** `components/modals/BusinessInfoModal.tsx`

**Form State Management:**
- Uses `useAppState()` hook for `businessInfo` state
- State is managed in `AppStateContext` (client-side only)
- Form fields are controlled inputs bound to `businessInfo` object

**Form Fields:**
- fullName (text)
- businessName (text) - **⚠️ No validation for required**
- businessType (text)
- location (text)
- operatingHours (parsed from operatingDays + operatingTimes)
- serviceName (text)
- services (textarea)
- website (text)
- contactEmail (email)
- contactPhone (tel)
- language (text)
- timezone (select)
- notes (textarea)

**Save Flow:**
1. User fills form
2. Clicks "Save" button
3. `handleSubmit` (line 188):
   - Checks for session (line 194-202)
   - Combines operating days/times (line 205)
   - Calls `POST /api/business-profile` with `businessInfo` object (line 207-216)
   - If response.ok is false, shows error (line 220-222)
   - On success, closes modal and sets localStorage flag

**Error Handling:**
- Error state is displayed in UI (line 385-394)
- Error message comes from API response or translation key
- Loading state prevents double-submission

### 3.2 Payload Shape Comparison

**UI Sends:**
```typescript
{
  fullName: string | "",
  businessName: string | "",  // ⚠️ Can be empty
  businessType: string | "",
  location: string | "",
  operatingHours: string | "",
  serviceName: string | "",
  services: string | "",
  website: string | "",
  contactEmail: string | "",
  contactPhone: string | "",
  language: string,
  timezone: string,
  notes: string | "",
}
```

**API Expects (Schema A):**
- All fields match ✅
- But API converts empty strings to `null` ✅

**API Expects (Schema B):**
- `business_name` must be NOT NULL ❌ (UI may send empty)
- `primary_website_url` doesn't exist ❌ (API uses wrong column name)
- Many fields don't exist ❌ (business_type, full_name, contact_email, etc.)

### 3.3 Mismatches Identified

1. **businessName can be empty:** UI allows empty, but Schema B requires NOT NULL
2. **Column name mismatch:** API writes to `primary_website_url`, but Schema B has `website_url`
3. **Missing columns in Schema B:** API tries to write to columns that don't exist in Schema B
4. **No client-side validation:** Form doesn't validate required fields before submission

---

## 4. Auth & Permissions Layer

### 4.1 RLS Policies

**Schema A RLS (from `20241129000000_business_profile_knowledge.sql`):**
- `Users can view their own business profile` - SELECT using `auth.uid() = user_id`
- `Users can insert their own business profile` - INSERT with CHECK `auth.uid() = user_id`
- `Users can update their own business profile` - UPDATE using/with CHECK `auth.uid() = user_id`
- `Users can delete their own business profile` - DELETE using `auth.uid() = user_id`

**Schema B RLS (from `20250124000000_business_info_schema.sql`):**
- `users_can_view_own_business_profiles` - SELECT using `auth.uid() = user_id`
- `users_can_modify_own_business_profiles` - ALL operations using `auth.uid() = user_id`

**RLS Status:**
- Both schemas have RLS enabled
- Policies look correct (users can only access their own data)
- **However:** API route uses `getSupabaseServerClient()` which **bypasses RLS entirely**
- This means RLS policies are not being enforced for business profile saves

### 4.2 Authentication Flow

**API Route:**
- Uses `requireAuthFromRequest(request)` from `lib/auth-helpers.ts`
- Extracts user from Supabase session in cookies
- Throws error if not authenticated
- Gets `user.id` for `user_id` field

**UI:**
- Checks for session before submitting (line 194-202)
- Shows error if not logged in

**Auth Status:**
- Authentication appears to be working correctly
- User ID is properly extracted and used

---

## 5. Likely Failure Causes

### 5.1 Most Probable Root Causes (Ranked)

#### 1. **Schema Conflict - Column Name Mismatch** (HIGHEST PROBABILITY)
**Location:** 
- Migration: `supabase/migrations/20250124000000_business_info_schema.sql` line 13
- API: `app/api/business-profile/route.ts` line 63

**Issue:** 
- API writes to `primary_website_url` (Schema A column)
- Schema B migration creates `website_url` (different name)
- If Schema B migration ran, column doesn't exist → PGRST204 error

**Evidence:**
- Two migrations define different column names for the same concept
- API code references `primary_website_url` explicitly
- Migration 20250124 creates `website_url` instead

**Check:**
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'business_profiles' 
AND column_name IN ('primary_website_url', 'website_url');
```

#### 2. **Schema Conflict - Missing Columns** (HIGH PROBABILITY)
**Location:**
- Migration: `supabase/migrations/20250124000000_business_info_schema.sql` (Schema B)
- API: `app/api/business-profile/route.ts` lines 57-74

**Issue:**
- Schema B is missing: `business_type`, `full_name`, `contact_email`, `contact_phone`, `services_offered`, `hours_of_operation`, `service_name`, `location`, `service_area`, `language`, `timezone`, `notes`
- API tries to write to all these columns
- If Schema B is active → PGRST204 "column does not exist" errors

**Evidence:**
- Schema B only has: business_name, website_url, description, default_currency, brand_voice
- API payload includes 13+ fields that don't exist in Schema B

**Check:**
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'business_profiles' 
ORDER BY column_name;
```

#### 3. **NOT NULL Constraint Violation** (HIGH PROBABILITY)
**Location:**
- Migration: `supabase/migrations/20250124000000_business_info_schema.sql` line 12
- UI: `components/modals/BusinessInfoModal.tsx` line 122
- API: `app/api/business-profile/route.ts` line 60

**Issue:**
- Schema B requires `business_name NOT NULL`
- UI allows empty `businessName` field (no validation)
- API converts empty to `null`: `business_name: body.businessName || null`
- If user submits empty business name → NOT NULL constraint violation

**Evidence:**
- Schema B line 12: `business_name TEXT NOT NULL`
- API line 60: `business_name: body.businessName || null` (can be null)
- UI has no required attribute or validation on businessName input

**Check:**
```sql
SELECT is_nullable 
FROM information_schema.columns 
WHERE table_name = 'business_profiles' 
AND column_name = 'business_name';
```

#### 4. **Migration Order Issue** (MEDIUM PROBABILITY)
**Location:**
- All migration files in `supabase/migrations/`

**Issue:**
- If `20250124000000_business_info_schema.sql` (Schema B) ran AFTER the Schema A migrations, it may have:
  - Dropped existing columns
  - Created a new minimal schema
  - Left the database in an inconsistent state

**Evidence:**
- Migration uses `CREATE TABLE IF NOT EXISTS` - won't recreate if table exists
- But if migrations ran out of order, Schema B might have been applied first
- Later migrations adding columns to Schema A would fail if Schema B was active

**Check:**
```sql
-- Check migration history
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version;
```

#### 5. **Error Swallowing / Poor Error Handling** (MEDIUM PROBABILITY)
**Location:**
- API: `app/api/business-profile/route.ts` lines 100-103, 171-176

**Issue:**
- Errors are logged to console but may not be properly returned to UI
- Generic error message "Failed to save business profile" doesn't help diagnose
- Database errors might be caught but not surfaced with details

**Evidence:**
- Line 101-102: `console.error` but error is thrown
- Line 175: Returns generic error message, original error details lost
- UI shows error from `data.error` but API might not include detailed error

**Check:**
- Review browser console for detailed error logs
- Check API response body for error details

#### 6. **RLS Bypass (Not a Failure Cause, But a Concern)**
**Location:**
- API: `app/api/business-profile/route.ts` line 54

**Issue:**
- Using service role client bypasses RLS
- This is intentional (for admin operations) but means RLS policies aren't tested
- If RLS was supposed to be enforced, this is a security gap

**Note:** This doesn't cause save failures, but is worth noting for security review.

---

## 6. Role of Business Info in Sync

### 6.1 Where Business Info is Consumed

#### 6.1.1 Sync Agent (Email Drafting)
**Files:**
- `lib/sync/generateDraft.ts` - Uses business context for email generation
- `lib/business-context.ts` - Main function: `getBusinessContext()`

**Usage:**
- `getBusinessContext(userId)` fetches business profile and knowledge chunks
- Used to generate business-aware email drafts
- Includes: business name, services, hours, location, contact info, knowledge chunks

**Impact of Missing Data:**
- Emails won't include business-specific information
- AI won't know business name, services, or policies
- Drafts will be generic, not personalized

#### 6.1.2 Aloha Agent (Call Handling)
**Files:**
- `lib/aloha/enhanced-call-handler.ts`
- `lib/aloha/scenario-handler.ts`
- `app/api/brain/route.ts` - System prompts reference business context

**Usage:**
- Business context provided in AI prompts for call handling
- Used to answer questions about services, pricing, hours, location
- Knowledge gaps logged when information is missing

**Impact of Missing Data:**
- AI can't answer business-specific questions
- Knowledge gaps will be logged frequently
- Callers won't get accurate information

#### 6.1.3 Smart Scheduling
**Files:**
- `lib/sync/smartScheduling.ts`

**Usage:**
- Uses business hours for scheduling suggestions
- Considers timezone and operating hours

**Impact of Missing Data:**
- Scheduling won't respect business hours
- Timezone-aware scheduling won't work

#### 6.1.4 Business Context Helper
**File:**
- `lib/business-context.ts` - `getBusinessContext()`

**Function:**
- Primary function all agents use to access business info
- Returns: `{ profile, knowledgeChunks }`
- Handles both Schema A fields (primary_website_url, etc.) and Schema B fields

**Current Implementation:**
- Reads from `business_profiles` table
- Maps database columns to context object
- Handles both string and JSONB for `services_offered`

### 6.2 Impact of Failed Saves

**If business info fails to save:**
1. **AI Drafts:** Will be generic, not business-aware
2. **Call Handling:** AI won't know business name, services, or policies
3. **Scheduling:** Won't respect business hours or timezone
4. **Knowledge Gaps:** Will be logged frequently as AI doesn't have business info
5. **User Experience:** Users won't see their business info reflected in AI responses

---

## 7. Final Summary & Next-Step Recommendations

### 7.1 How Business Info Should Flow

**Intended Flow:**
1. User opens Business Info modal
2. User fills form with business details
3. UI sends POST to `/api/business-profile` with all fields
4. API authenticates user
5. API upserts to `business_profiles` table (Schema A structure)
6. API creates/updates `business_knowledge_chunks` with form data
7. API triggers website crawl if URL provided
8. Success response returned to UI
9. UI closes modal
10. Business context is available for AI agents via `getBusinessContext()`

### 7.2 Why It's Likely Failing

**Top 3 Specific Reasons:**

1. **Schema Conflict - Two Incompatible Table Definitions**
   - Migration `20241129000000` creates Schema A with `primary_website_url`, `business_type`, `full_name`, etc.
   - Migration `20250124000000` creates Schema B with `website_url` (different name), `business_name NOT NULL`, and missing many columns
   - If Schema B migration ran, API writes to non-existent columns → PGRST204 errors
   - **Files:** `supabase/migrations/20250124000000_business_info_schema.sql`, `app/api/business-profile/route.ts:63`

2. **NOT NULL Constraint Violation**
   - Schema B requires `business_name NOT NULL`
   - UI allows empty business name (no validation)
   - API converts empty to `null` → violates constraint
   - **Files:** `supabase/migrations/20250124000000_business_info_schema.sql:12`, `app/api/business-profile/route.ts:60`

3. **Column Name Mismatch**
   - API writes to `primary_website_url` (Schema A)
   - Schema B has `website_url` (different name)
   - If Schema B is active, column doesn't exist → error
   - **Files:** `app/api/business-profile/route.ts:63`, `supabase/migrations/20250124000000_business_info_schema.sql:13`

### 7.3 Diagnostic Checklist

**For Developer to Confirm Each Suspected Cause:**

#### Check 1: Which Schema is Active?
```sql
-- Run in Supabase SQL Editor
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'business_profiles'
ORDER BY column_name;
```

**Expected Results:**
- **If Schema A:** Should see `primary_website_url`, `business_type`, `full_name`, `contact_email`, `contact_phone`, `services_offered`, `hours_of_operation`, etc.
- **If Schema B:** Should see `website_url` (not `primary_website_url`), `business_name` (NOT NULL), `default_currency`, `brand_voice`, but missing many Schema A columns

#### Check 2: Is business_name NOT NULL?
```sql
SELECT is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'business_profiles'
AND column_name = 'business_name';
```

**Expected Results:**
- **If Schema A:** `is_nullable = 'YES'` (nullable)
- **If Schema B:** `is_nullable = 'NO'` (NOT NULL) ⚠️

#### Check 3: Does primary_website_url Column Exist?
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'business_profiles'
AND column_name IN ('primary_website_url', 'website_url');
```

**Expected Results:**
- **If Schema A:** Should see `primary_website_url`
- **If Schema B:** Should see `website_url` (not `primary_website_url`) ⚠️

#### Check 4: Check Migration History
```sql
-- If using Supabase migrations table
SELECT version, name, executed_at
FROM supabase_migrations.schema_migrations
WHERE name LIKE '%business%'
ORDER BY executed_at;
```

**Expected Results:**
- Should see which business-related migrations have run
- Check if `20250124000000_business_info_schema.sql` ran and when

#### Check 5: Test API with Empty businessName
```bash
# In browser console or Postman
fetch('/api/business-profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    businessName: '',  // Empty string
    businessType: 'Test',
    // ... other fields
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Expected Results:**
- **If Schema B active:** Should get error about NOT NULL constraint or missing columns
- **If Schema A active:** Should succeed (business_name is nullable)

#### Check 6: Check Browser Console for Errors
- Open browser DevTools → Console
- Try to save business info
- Look for:
  - Network errors (404, 500)
  - Error messages in response
  - Console.error logs from API

#### Check 7: Check Server Logs
- Check Next.js server logs for:
  - `[Business Profile] Update error:` or `[Business Profile] Insert error:`
  - PGRST204 errors (column does not exist)
  - NOT NULL constraint violations

### 7.4 Recommended Fix Strategy (For Future Implementation)

**Option A: Use Schema A (Recommended)**
1. Remove or rename `20250124000000_business_info_schema.sql` migration
2. Ensure all Schema A migrations have run
3. Update API to handle nullable `business_name` properly
4. Add client-side validation for required fields

**Option B: Migrate to Schema B**
1. Update API route to use Schema B column names (`website_url` not `primary_website_url`)
2. Remove writes to non-existent columns
3. Add client-side validation for `business_name` (required)
4. Migrate existing data from Schema A to Schema B structure
5. Update `getBusinessContext()` to read from Schema B

**Option C: Merge Schemas**
1. Keep Schema A as base
2. Add Schema B's new tables (business_services, business_pricing_tiers, etc.) as additional features
3. Ensure all columns from both schemas exist
4. Update API to support both old and new structures

### 7.5 Immediate Action Items

1. **Run diagnostic SQL queries** (Check 1-4 above) to confirm which schema is active
2. **Check browser console** when saving business info to see exact error
3. **Check server logs** for database errors
4. **Verify migration order** - ensure Schema A migrations ran before Schema B
5. **Decide on schema strategy** - choose Option A, B, or C above
6. **Fix schema conflict** - either remove conflicting migration or update API to match active schema
7. **Add validation** - ensure `business_name` is required in UI if Schema B is used
8. **Update error handling** - surface detailed database errors to UI for debugging

---

## Appendix: File References

### Key Files
- `app/api/business-profile/route.ts` - API route for saving business info
- `components/modals/BusinessInfoModal.tsx` - UI form component
- `lib/business-context.ts` - Business context helper for AI agents
- `lib/sync/businessInfo.ts` - Alternative business info service (uses Schema B structure)
- `supabase/migrations/20241129000000_business_profile_knowledge.sql` - Schema A definition
- `supabase/migrations/20250124000000_business_info_schema.sql` - Schema B definition (CONFLICTS)
- `types/index.ts` - TypeScript types for BusinessInfo and BusinessProfile

### Related Files
- `context/AppStateContext.tsx` - Client-side state management
- `lib/auth-helpers.ts` - Authentication helpers
- `lib/supabaseServerClient.ts` - Supabase client (bypasses RLS)
- `lib/sync/generateDraft.ts` - Uses business context for email drafts
- `lib/aloha/enhanced-call-handler.ts` - Uses business context for calls

---

**End of Report**


