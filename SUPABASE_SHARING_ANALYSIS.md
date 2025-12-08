# Supabase Sharing Analysis: Web App vs Mobile App

## Executive Summary

**NO, web and mobile are NOT currently sharing the same Supabase project and user data.**

The mobile app does not use Supabase at all. It's configured to make HTTP requests to a REST API endpoint that doesn't exist in the web app.

---

## 1. Supabase Client Setup

### Web App ✅
**Location:** `lib/supabaseClient.ts`

```typescript
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseBrowserClient = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey
);
```

**Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Server Client:** `lib/supabaseServerClient.ts` (uses service role key for admin operations)

### Mobile App ❌
**Status:** Supabase is NOT installed or configured

**Current Setup:** `ovrsee-mobile/src/api/http.ts`
- Makes HTTP requests to `EXPO_PUBLIC_API_URL` (defaults to `https://api.ovrsee.com`)
- Tries to call `/user/me` endpoint which **does not exist** in the web app
- No Supabase client initialization found
- `@supabase/supabase-js` is NOT in `package.json`

---

## 2. Environment Variables Comparison

| App | Supabase URL Var | Supabase Anon Key Var | Status |
|-----|-----------------|----------------------|--------|
| Web | `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Configured |
| Mobile | ❌ None | ❌ None | ❌ Not configured |

**Result:** Mobile app has no Supabase configuration.

---

## 3. User Profile Data Access

### Web App ✅
**Table:** `profiles`
**User ID Mapping:** `profiles.id` = `auth.users.id` (1:1 relationship)

**Example Usage:**
```typescript
// From app/api/subscription/route.ts
const { data: profile } = await supabase
  .from("profiles")
  .select("subscription_tier, subscription_status, ...")
  .eq("id", userId)
  .single();
```

**Key Fields Used:**
- `id` (UUID, references `auth.users.id`)
- `email`
- `subscription_tier`
- `subscription_status`
- `stripe_customer_id`
- `stripe_subscription_id`
- `trial_ends_at`
- `has_used_trial`
- `data_retention_expires_at`

### Mobile App ❌
**Status:** No profile data access implemented
- Tries to call `/user/me` API endpoint (doesn't exist)
- No Supabase queries
- No authentication setup

---

## 4. Authentication

### Web App ✅
**Method:** Supabase Auth
- Uses `auth.getUser()` and `auth.getSession()`
- Session management via cookies (Next.js SSR)
- Helper functions in `lib/auth-helpers.ts`:
  - `getAuthenticatedUser()`
  - `requireAuth()`
  - `getAuthenticatedSupabaseClient()`

### Mobile App ❌
**Status:** No authentication implemented
- No auth token management
- No Supabase auth calls
- Commented out auth token code in `http.ts`:
  ```typescript
  // const token = await getAuthToken();
  // if (token) {
  //   defaultHeaders.Authorization = `Bearer ${token}`;
  // }
  ```

---

## 5. Data Sharing Analysis

### Current State
**Will a user logging in on web and then mobile see the same data?**
**NO** - The mobile app cannot access any user data because:
1. It doesn't use Supabase
2. The API endpoint it tries to call (`/user/me`) doesn't exist
3. There's no authentication mechanism

### What Would Need to Change
To enable data sharing, the mobile app must:
1. Install `@supabase/supabase-js` package
2. Initialize Supabase client with the **same URL and anon key** as the web app
3. Use Supabase Auth for authentication
4. Query the same `profiles` table using the same user ID mapping

---

## 6. Required Changes

### Option A: Direct Supabase Integration (Recommended)

#### Step 1: Install Supabase in Mobile App
```bash
cd ovrsee-mobile
npm install @supabase/supabase-js
```

#### Step 2: Create Supabase Client
**File:** `ovrsee-mobile/src/lib/supabase.ts` (new file)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required Supabase environment variables: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

#### Step 3: Set Environment Variables
**File:** `.env` or `.env.local` in `ovrsee-mobile/`

```bash
# Use the SAME values as your web app's .env.local
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**⚠️ CRITICAL:** These must be **identical** to:
- `NEXT_PUBLIC_SUPABASE_URL` in web app
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` in web app

#### Step 4: Update User API
**File:** `ovrsee-mobile/src/api/user.ts`

Replace with:
```typescript
import { supabase } from '@/lib/supabase';
import { User, ApiResponse } from '@/types';

export async function getCurrentUser(): Promise<ApiResponse<User>> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        data: null as any,
        error: authError?.message || 'Not authenticated',
      };
    }

    // Get profile from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return {
        data: null as any,
        error: profileError.message,
      };
    }

    return {
      data: {
        id: user.id,
        email: user.email,
        ...profile,
      } as User,
    };
  } catch (error) {
    return {
      data: null as any,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

#### Step 5: Add Authentication Flow
Implement Supabase Auth in the mobile app:
- Sign in: `supabase.auth.signInWithPassword()`
- Sign up: `supabase.auth.signUp()`
- Sign out: `supabase.auth.signOut()`
- Session management: `supabase.auth.getSession()`

---

### Option B: REST API Approach (Not Recommended)

If you prefer to keep the mobile app using REST API calls, you would need to:

1. Create `/api/user/me` endpoint in the web app
2. Implement authentication token validation
3. Return user profile data from Supabase

However, this adds unnecessary complexity and doesn't leverage Supabase's built-in features.

---

## 7. Verification Checklist

After implementing the changes, verify:

- [ ] Mobile app has `@supabase/supabase-js` installed
- [ ] `EXPO_PUBLIC_SUPABASE_URL` matches `NEXT_PUBLIC_SUPABASE_URL` exactly
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` matches `NEXT_PUBLIC_SUPABASE_ANON_KEY` exactly
- [ ] Mobile app can authenticate users via Supabase Auth
- [ ] Mobile app queries `profiles` table with same `id` mapping
- [ ] User logging in on web can log in on mobile with same email
- [ ] User sees same profile data (subscription, trial status, etc.) on both platforms

---

## 8. Summary

**Current Status:** ❌ **NO, web and mobile are NOT sharing the same Supabase project**

**Root Cause:** Mobile app doesn't use Supabase at all.

**Solution:** Install Supabase in mobile app and use the same environment variables (URL and anon key) as the web app.

**Files to Create/Modify:**
1. `ovrsee-mobile/src/lib/supabase.ts` (new)
2. `ovrsee-mobile/src/api/user.ts` (modify)
3. `ovrsee-mobile/.env` (add env vars)
4. `ovrsee-mobile/package.json` (add dependency)

**Critical Requirement:** Both apps must use **identical** Supabase URL and anon key values to access the same project and data.




