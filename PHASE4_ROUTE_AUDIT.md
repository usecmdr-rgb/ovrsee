# Phase 4: Route Audit Report

**Date:** $(date)  
**Scope:** Complete audit of all routes in `/app` directory to identify unused/legacy routes for cleanup

---

## I18N Update: Agent Tab Labels Translation-Aware

**Date:** $(date)  
**Issue:** Agent tabs (Sync, Studio, Insight) were not translation-aware, while Summary/Resumen and Aloha tabs worked correctly.

### Changes Made:

1. **Added Translation Keys** (`lib/translations/index.ts`):
   - Added `alohaLabel`, `syncLabel`, `studioLabel`, `insightLabel` to all 10 language dictionaries
   - Keys added after `summary` key in each language section for consistency

2. **Updated AppSidebar Component** (`components/app/AppSidebar.tsx`):
   - Changed `agentLinks` memoization to use translation keys instead of hard-coded `agent.label` from config
   - Added `t` to dependency array so labels update when language changes
   - Pattern matches the working Summary tab implementation

### Components Made i18n-Aware:
- ✅ `components/app/AppSidebar.tsx` - All agent tabs now use translation keys

### Translation Keys Added:
- `alohaLabel` - "Aloha" (all languages)
- `syncLabel` - "Sync" (all languages)
- `studioLabel` - "Studio" (all languages)
- `insightLabel` - "Insight" (all languages)

### Verification:
- ✅ TypeScript compilation passes
- ✅ Build succeeds
- ✅ All agent tabs now react to language changes
- ✅ Summary/Resumen tab continues to work as before (unchanged)

---

## Summary

**Total Routes Found:** 15+ route folders  
**Active Routes:** 9  
**Legacy/Duplicate Routes:** 6  
**Safe to Delete:** TBD (pending verification)

---

## IN USE - Active Routes ✅

### 1. `/` (Root/Landing Page)
**Location:** `app/page.tsx`  
**Status:** ✅ **ACTIVE**  
**References:**
- Linked in Header navigation as "Home"
- Main entry point for application
- **Action:** KEEP

---

### 2. `/about`
**Location:** `app/about/page.tsx`  
**Status:** ✅ **ACTIVE**  
**References:**
- Linked in Header navigation (`components/layout/Header.tsx:200`)
- Linked from landing page (`app/page.tsx:83`)
- **Action:** KEEP

---

### 3. `/pricing`
**Location:** `app/pricing/page.tsx`  
**Status:** ✅ **ACTIVE**  
**References:**
- Linked in Header navigation (`components/layout/Header.tsx:199`)
- Linked from PreviewBanner (`components/agent/PreviewBanner.tsx:44`)
- Linked from DataRetentionBanner (`components/subscription/DataRetentionBanner.tsx`)
- Linked from TrialExpiredBanner (`components/subscription/TrialExpiredBanner.tsx:28, 56`)
- **Action:** KEEP

---

### 4. `/app` (Dashboard)
**Location:** `app/app/page.tsx`  
**Status:** ✅ **ACTIVE**  
**References:**
- Linked in Header navigation (`components/layout/Header.tsx:201`)
- Main dashboard route
- Also accessible via `/dashboard` (alias - see below)
- **Action:** KEEP

---

### 5. `/aloha`
**Location:** `app/aloha/page.tsx`  
**Status:** ✅ **ACTIVE**  
**References:**
- Defined in agent config (`lib/config/agents.ts:34`) - route: `/aloha`
- Linked in AppSidebar (`components/app/AppSidebar.tsx`)
- Has sub-routes:
  - `/aloha/campaigns`
  - `/aloha/campaigns/new`
  - `/aloha/contacts`
  - `/aloha/knowledge-gaps`
  - `/aloha/settings`
- **Action:** KEEP

---

### 6. `/sync`
**Location:** `app/sync/page.tsx`  
**Status:** ✅ **ACTIVE**  
**References:**
- Defined in agent config (`lib/config/agents.ts:54`) - route: `/sync`
- Linked in AppSidebar (`components/app/AppSidebar.tsx`)
- Has sub-routes:
  - `/sync/calendar`
- **Action:** KEEP

---

### 7. `/studio`
**Location:** `app/studio/page.tsx`  
**Status:** ✅ **ACTIVE**  
**References:**
- Defined in agent config (`lib/config/agents.ts:44`) - route: `/studio`
- Linked in AppSidebar (`components/app/AppSidebar.tsx`)
- **Action:** KEEP

---

### 8. `/insight`
**Location:** `app/insight/page.tsx`  
**Status:** ✅ **ACTIVE**  
**References:**
- Defined in agent config (`lib/config/agents.ts:64`) - route: `/insight`
- Linked in AppSidebar (`components/app/AppSidebar.tsx`)
- **Action:** KEEP

---

### 9. `/account/subscription`
**Location:** `app/account/subscription/page.tsx`  
**Status:** ✅ **ACTIVE**  
**References:**
- Linked in UserMenu (`components/layout/UserMenu.tsx:35`) - `router.push("/account/subscription")`
- Linked from TrialExpiredBanner (`components/subscription/TrialExpiredBanner.tsx:63`)
- **Action:** KEEP

---

## POSSIBLY USED / NEEDS REVIEW ⚠️

### 10. `/dashboard`
**Location:** `app/dashboard/page.tsx`  
**Status:** ⚠️ **ALIAS/DUPLICATE**  
**References:**
- Referenced in AppSidebar (`components/app/AppSidebar.tsx:34`) - checks for `/dashboard` OR `/app`
- Referenced in dashboard page (`app/app/page.tsx:226`) - pathname check
- Appears to be an alias for `/app`
- **Questions:**
  - Is this used as a redirect target?
  - Should we consolidate to `/app` only?
- **Action:** REVIEW - May be safe to delete if `/app` is the canonical route

---

### 11. `/app/aloha`
**Location:** `app/app/aloha/page.tsx`  
**Status:** ⚠️ **DUPLICATE**  
**References:**
- Duplicate of `/aloha`
- Content appears identical to top-level `/aloha`
- **Questions:**
  - Is this accessed anywhere?
  - Should redirect to `/aloha`?
- **Action:** REVIEW - Likely safe to delete if no references

---

### 12. `/app/alpha`
**Location:** `app/app/alpha/page.tsx`  
**Status:** ⚠️ **LEGACY/DUPLICATE**  
**References:**
- Legacy route (alpha → aloha)
- Content similar to `/aloha` but older
- **Questions:**
  - Should redirect to `/aloha`?
  - Any active links?
- **Action:** REVIEW - Likely safe to delete if no references

---

### 13. `/app/xi`
**Location:** `app/app/xi/page.tsx`  
**Status:** ⚠️ **LEGACY/DUPLICATE**  
**References:**
- Legacy route (xi → sync)
- **Questions:**
  - Should redirect to `/sync`?
  - Any active links?
- **Action:** REVIEW - Likely safe to delete if no references

---

### 14. `/app/mu`
**Location:** `app/app/mu/layout.tsx` (no page.tsx found)  
**Status:** ⚠️ **LEGACY/INCOMPLETE**  
**References:**
- Legacy route (mu → studio)
- Only has layout, no page
- **Questions:**
  - Is this used?
  - Should redirect to `/studio`?
- **Action:** REVIEW - Likely safe to delete

---

### 15. `/app/beta`
**Location:** `app/app/beta/layout.tsx` (no page.tsx found)  
**Status:** ⚠️ **LEGACY/INCOMPLETE**  
**References:**
- Legacy route (beta → insight)
- Only has layout, no page
- **Questions:**
  - Is this used?
  - Should redirect to `/insight`?
- **Action:** REVIEW - Likely safe to delete

---

## LEGACY ROUTES - Top Level (Old Agent Names) 🔴

### 16. `/alpha`
**Location:** `app/alpha/page.tsx`  
**Status:** 🔴 **LEGACY**  
**References:**
- Old name for Aloha agent
- Agent config shows mapping: `alpha → aloha`
- Content identical to `/aloha`
- **Questions:**
  - Should redirect to `/aloha`?
  - Any bookmarks or external links?
- **Action:** REVIEW - Should redirect to `/aloha` or delete

---

### 17. `/beta`
**Location:** `app/beta/page.tsx`  
**Status:** 🔴 **LEGACY**  
**References:**
- Old name for Insight agent
- Agent config shows mapping: `beta → insight`
- **Questions:**
  - Should redirect to `/insight`?
  - Any bookmarks or external links?
- **Action:** REVIEW - Should redirect to `/insight` or delete

---

### 18. `/mu`
**Location:** `app/mu/page.tsx`  
**Status:** 🔴 **LEGACY**  
**References:**
- Old name for Studio agent
- Agent config shows mapping: `mu → studio`
- **Questions:**
  - Should redirect to `/studio`?
  - Any bookmarks or external links?
- **Action:** REVIEW - Should redirect to `/studio` or delete

---

### 19. `/xi`
**Location:** `app/xi/page.tsx`  
**Status:** 🔴 **LEGACY**  
**References:**
- Old name for Sync agent
- Agent config shows mapping: `xi → sync`
- **Questions:**
  - Should redirect to `/sync`?
  - Any bookmarks or external links?
- **Action:** REVIEW - Should redirect to `/sync` or delete

---

## Route Mapping Reference

Based on `lib/config/agents.ts`:
- **alpha** → **aloha** (voice & call agent)
- **mu** → **studio** (content, editing & branding agent)
- **xi** → **sync** (email & calendar agent)
- **beta** → **insight** (analytics & business intelligence agent)

---

## Redirects Already Configured ✅

**Found in:** `next.config.mjs`

The following redirects are already in place:
- `/alpha` → `/aloha` ✅
- `/app/alpha` → `/app/aloha` ✅
- `/xi` → `/sync` ✅
- `/app/xi` → `/app/sync` ✅
- `/mu` → `/studio` ✅
- `/app/mu` → `/app/studio` ✅
- `/beta` → `/insight` ✅
- `/app/beta` → `/app/insight` ✅

**Note:** The redirects for `/app/*` routes redirect to `/app/aloha`, `/app/sync`, `/app/studio`, `/app/insight`, but these routes don't appear to exist. The actual routes are at top-level: `/aloha`, `/sync`, `/studio`, `/insight`.

**Issue:** Redirect destinations may be incorrect. Should redirect to top-level routes, not `/app/*` routes.

---

## Recommendations

### Immediate Actions:

1. **Fix Redirect Destinations:**
   - Update `/app/alpha` → `/aloha` (not `/app/aloha`)
   - Update `/app/xi` → `/sync` (not `/app/sync`)
   - Update `/app/mu` → `/studio` (not `/app/studio`)
   - Update `/app/beta` → `/insight` (not `/app/insight`)

2. **Consolidate Dashboard Routes:**
   - Choose either `/app` or `/dashboard` as canonical
   - Add redirect from one to the other if needed
   - Update all references

3. **Remove Legacy Route Folders (SAFE TO DELETE):**
   Since redirects are in place, these folders can be deleted:
   - ✅ `/app/alpha` (redirected to `/app/aloha`)
   - ✅ `/app/xi` (redirected to `/app/sync`)
   - ✅ `/app/mu` (redirected to `/app/studio`)
   - ✅ `/app/beta` (redirected to `/app/insight`)
   - ✅ `/alpha` (redirected to `/aloha`)
   - ✅ `/beta` (redirected to `/insight`)
   - ✅ `/mu` (redirected to `/studio`)
   - ✅ `/xi` (redirected to `/sync`)

4. **Remove Duplicate Routes:**
   - ⚠️ `/app/aloha` - Check if this is used or should redirect to `/aloha`
   - ⚠️ `/dashboard` - Decide if this should redirect to `/app` or be consolidated

5. **Verify Before Deletion:**
   - Check Google Analytics for traffic to legacy routes
   - Check for external links or bookmarks
   - Check API routes that might reference these paths
   - Check database records that might reference routes

---

## Next Steps

1. ✅ Complete route audit (this document)
2. ⏳ Verify redirect configuration in `next.config.mjs`
3. ⏳ Check for any API route references to legacy paths
4. ⏳ Check database for stored route references
5. ⏳ Create redirects for legacy routes
6. ⏳ Delete duplicate/unused routes
7. ⏳ Test all redirects work correctly
8. ⏳ Update documentation

---

## Files to Review for References

- `middleware.ts` - Check for route handling
- `next.config.mjs` - Check for redirects/rewrites
- `lib/config/agents.ts` - Agent route definitions
- `components/app/AppSidebar.tsx` - Navigation links
- `components/layout/Header.tsx` - Navigation links
- All API routes in `/app/api/` - Check for route references
- Database migrations - Check for stored route paths

---

**Status:** Audit Complete - Ready for Review and Cleanup Plan

