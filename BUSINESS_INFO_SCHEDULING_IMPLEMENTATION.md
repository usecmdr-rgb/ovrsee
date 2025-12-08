# Business Info + Pricing + Smart Scheduling Integration - Implementation Summary

## Overview

Successfully implemented Business Info + Pricing + Smart Scheduling Integration for Sync, enabling business-aware email drafting with accurate pricing, services, and calendar-based time slot suggestions.

## Implementation Complete ✅

### 1. Database Schema

**Migration:** `supabase/migrations/20250124000000_business_info_schema.sql`

**Tables Created:**
- ✅ `business_profiles` - Main business information (name, website, description, brand voice)
- ✅ `business_services` - Services offered by the business
- ✅ `business_pricing_tiers` - Pricing tiers for services or bundles
- ✅ `business_hours` - Operating hours by day of week
- ✅ `business_faqs` - Frequently asked questions
- ✅ `business_website_snapshots` - Website content snapshots (optional)

**Migration:** `supabase/migrations/20250124000001_extend_user_sync_preferences.sql`

**Extended:**
- ✅ `user_sync_preferences` - Added smart scheduling preferences:
  - `prefers_auto_time_suggestions` (boolean)
  - `default_meeting_duration_minutes` (integer)
  - `scheduling_time_window_days` (integer)

**Features:**
- ✅ Row Level Security (RLS) policies for all tables
- ✅ Updated_at triggers for automatic timestamp management
- ✅ Indexes for efficient queries
- ✅ Foreign key constraints with CASCADE deletes

### 2. Business Info Management Service

**File:** `lib/sync/businessInfo.ts`

**Functions:**
- ✅ `upsertBusinessProfile()` - Create/update business profile
- ✅ `getBusinessProfileByUserId()` - Get profile by user ID
- ✅ `upsertBusinessService()` - Create/update service
- ✅ `deleteBusinessService()` - Delete service
- ✅ `upsertBusinessPricingTier()` - Create/update pricing tier
- ✅ `deleteBusinessPricingTier()` - Delete pricing tier
- ✅ `setBusinessHours()` - Set hours for a day
- ✅ `upsertBusinessFAQ()` - Create/update FAQ
- ✅ `getBusinessContextForUser()` - **Main function** - Returns complete business context bundle

**BusinessContextBundle Structure:**
```typescript
{
  profile: BusinessProfile | null;
  services: BusinessService[];
  pricingTiers: BusinessPricingTier[];
  hours: BusinessHours[];
  faqs: BusinessFAQ[];
  websiteSummary?: string | null;
}
```

### 3. Website Knowledge Integration

**File:** `lib/sync/websiteKnowledge.ts`

**Functions:**
- ✅ `fetchAndStoreWebsiteSnapshot()` - Fetch and store website content (stub implementation)
- ✅ `getBusinessWebsiteContext()` - Get combined website context

**Status:**
- ✅ Feature flag controlled (`BUSINESS_WEBSITE_CONTEXT_ENABLED`)
- ✅ Stub implementation ready for extension
- ✅ Stores snapshots in `business_website_snapshots` table

**TODO:** Implement actual website scraping (can use Puppeteer, Playwright, or simple HTTP fetch)

### 4. Smart Scheduling

**File:** `lib/sync/smartScheduling.ts`

**Functions:**
- ✅ `getAvailableTimeSlots()` - Get available time slots based on:
  - Calendar free/busy data (from `sync_calendar_events`)
  - Business hours constraints
  - User preferences
- ✅ `formatTimeSlotForAI()` - Format time slot for AI prompts

**Features:**
- ✅ Respects business hours (open/close times per day)
- ✅ Excludes busy calendar times
- ✅ Configurable slot duration (default: 60 minutes)
- ✅ Configurable time window (default: 7 days, max: 30 days)
- ✅ Returns top 10 available slots, sorted by start time

**TimeSlot Structure:**
```typescript
{
  start: string; // ISO 8601
  end: string; // ISO 8601
  timezone: string;
  source: "calendar" | "business_hours";
}
```

### 5. AI Draft Integration

**File:** `lib/sync/generateDraft.ts`

**Enhanced:**
- ✅ Fetches business context (services, pricing, hours, FAQs)
- ✅ Fetches available time slots for scheduling emails
- ✅ Includes business info in AI prompt
- ✅ Includes time slots in AI prompt when scheduling-related
- ✅ Updated system prompt with business awareness instructions

**Prompt Instructions Added:**
- ✅ Use ONLY provided pricing/services (no hallucination)
- ✅ Match brand voice from business profile
- ✅ Suggest specific time slots from availableTimeSlots list
- ✅ Reference business hours and FAQs when relevant
- ✅ Offer custom quotes if pricing not available

**Context Flow:**
1. Thread context (if enabled)
2. Business info context (if enabled)
3. Available time slots (if scheduling-related)
4. Legacy business context (fallback)

### 6. Feature Flags

**File:** `lib/sync/featureFlags.ts`

**New Flags:**
- ✅ `isBusinessInfoAwareDraftsEnabled()` - `BUSINESS_INFO_AWARE_DRAFTS_ENABLED`
- ✅ `isSmartSchedulingSuggestionsEnabled()` - `SMART_SCHEDULING_SUGGESTIONS_ENABLED`
- ✅ `isBusinessWebsiteContextEnabled()` - `BUSINESS_WEBSITE_CONTEXT_ENABLED`

## Files Created/Modified

### New Files
1. `supabase/migrations/20250124000000_business_info_schema.sql` - Business info tables
2. `supabase/migrations/20250124000001_extend_user_sync_preferences.sql` - Scheduling preferences
3. `lib/sync/businessInfo.ts` - Business info management service
4. `lib/sync/smartScheduling.ts` - Smart scheduling helper
5. `lib/sync/websiteKnowledge.ts` - Website knowledge integration (stub)
6. `BUSINESS_INFO_SCHEDULING_IMPLEMENTATION.md` - This document

### Modified Files
1. `lib/sync/generateDraft.ts` - Enhanced with business info and scheduling
2. `lib/sync/featureFlags.ts` - Added new feature flags

## Configuration

### Environment Variables

```bash
# Enable business info aware drafts
BUSINESS_INFO_AWARE_DRAFTS_ENABLED=true

# Enable smart scheduling suggestions
SMART_SCHEDULING_SUGGESTIONS_ENABLED=true

# Enable website knowledge (optional)
BUSINESS_WEBSITE_CONTEXT_ENABLED=true

# Existing flags
THREAD_CONTEXT_FOR_DRAFTS_ENABLED=true
DRAFT_SEND_CALENDAR_ALERTS_ENABLED=true
SYNC_INTELLIGENCE_ENABLED=true
```

### User Preferences

Users can configure via `user_sync_preferences`:
- `prefers_auto_time_suggestions` - Enable/disable time slot suggestions
- `default_meeting_duration_minutes` - Default meeting length (30, 60, etc.)
- `scheduling_time_window_days` - Days ahead to look for slots (1-30)

## How to Verify

### 1. Set Up Business Info

**Option A: Via SQL (for testing)**
```sql
-- Create business profile
INSERT INTO business_profiles (user_id, business_name, website_url, description, brand_voice)
VALUES ('your-user-id', 'My Business', 'https://example.com', 'We provide great services', 'professional');

-- Get business_id
SELECT id FROM business_profiles WHERE user_id = 'your-user-id';

-- Add services
INSERT INTO business_services (business_id, name, description, category)
VALUES 
  ('business-id', 'Consulting', 'Business consulting services', 'Services'),
  ('business-id', 'Training', 'Professional training programs', 'Services');

-- Add pricing tiers
INSERT INTO business_pricing_tiers (business_id, service_id, name, price_amount, billing_interval)
VALUES 
  ('business-id', 'service-id-1', 'Basic Plan', 99.00, 'monthly'),
  ('business-id', 'service-id-1', 'Pro Plan', 199.00, 'monthly');

-- Set business hours
INSERT INTO business_hours (business_id, day_of_week, open_time, close_time, timezone)
VALUES 
  ('business-id', 1, '09:00:00', '17:00:00', 'America/New_York'), -- Monday
  ('business-id', 2, '09:00:00', '17:00:00', 'America/New_York'), -- Tuesday
  -- ... etc
  ('business-id', 0, NULL, NULL, 'America/New_York', true); -- Sunday (closed)
```

**Option B: Via API (future UI)**
- Create API endpoints that use `lib/sync/businessInfo.ts` functions
- Build UI form for business info management

### 2. Test Business-Aware Drafts

**Steps:**
1. Set `BUSINESS_INFO_AWARE_DRAFTS_ENABLED=true`
2. Ensure business profile exists for your user
3. Open Sync → Select an email asking about pricing/services
4. Generate draft
5. **Verify:** Draft includes accurate pricing and services from your business info

**Example Email:**
```
Subject: Pricing Inquiry
Body: Hi, I'm interested in your consulting services. What are your pricing options?
```

**Expected Draft:**
- References specific services from `business_services`
- Includes accurate pricing from `business_pricing_tiers`
- Matches brand voice from `business_profiles.brand_voice`

### 3. Test Smart Scheduling

**Steps:**
1. Set `SMART_SCHEDULING_SUGGESTIONS_ENABLED=true`
2. Ensure:
   - Business hours are set
   - Calendar is connected and synced
   - Email has appointment intent (via Phase 1 detection)
3. Generate draft for scheduling email
4. **Verify:** Draft includes specific time slots from calendar availability

**Example Email:**
```
Subject: Schedule a Demo
Body: Can we schedule a demo call next week?
```

**Expected Draft:**
- Includes 2-3 specific time slots
- Slots respect business hours
- Slots exclude busy calendar times
- Times are formatted clearly with timezone

### 4. Test End-to-End Flow

**Scenario:** Client emails asking about pricing and scheduling

**Steps:**
1. Client sends: "What are your pricing options for consulting? Also can we book a demo next week?"
2. Phase 1 intelligence:
   - Classifies email (sales/scheduling)
   - Detects appointment intent
3. Generate draft:
   - Loads business services and pricing
   - Loads available time slots
   - Generates reply with:
     - Accurate pricing details
     - 2-3 specific time slot options
4. User sends draft
5. Phase 2 logic:
   - Creates calendar event/reminder

**Verify:**
- Draft includes correct pricing
- Draft includes real available time slots
- Calendar event created on send

### 5. Test Feature Flags

**Test with flags OFF:**
1. Set `BUSINESS_INFO_AWARE_DRAFTS_ENABLED=false`
2. Generate draft
3. **Verify:** Draft works but doesn't include business info

**Test with flags ON:**
1. Set `BUSINESS_INFO_AWARE_DRAFTS_ENABLED=true`
2. Generate draft
3. **Verify:** Draft includes business info

## Database Schema Details

### business_profiles
- One profile per user (UNIQUE constraint on user_id)
- Brand voice options: formal, friendly, casual_professional, professional, casual
- Default currency: USD

### business_services
- Many-to-one with business_profiles
- Can be categorized (generic category field)
- Active/inactive flag

### business_pricing_tiers
- Many-to-one with business_profiles
- Optional link to business_services (for service-specific pricing)
- Supports multiple billing intervals
- Default tier flag

### business_hours
- One entry per day per business (UNIQUE on business_id, day_of_week)
- Day 0 = Sunday, 6 = Saturday
- Time format: TIME (HH:MM:SS)
- Timezone per entry

### business_faqs
- Many-to-one with business_profiles
- Simple Q&A structure

## Edge Cases Handled

1. **No business profile** - Falls back to generic draft behavior
2. **No pricing** - AI offers custom quote instead of inventing prices
3. **No business hours** - Uses default 9 AM - 5 PM
4. **No calendar events** - All slots within business hours are available
5. **No available slots** - AI suggests checking back later
6. **Feature flags disabled** - Graceful fallback to previous behavior

## Performance Considerations

- **Business context fetch** - Single query with joins (efficient)
- **Time slot calculation** - Processes up to 14 days, limits to top 10 slots
- **Calendar query** - Indexed on workspace_id and start_at
- **Token usage** - Business info adds ~500-1000 tokens to prompt

## Next Steps

1. **Implement website scraping** - Extend `websiteKnowledge.ts` with actual fetching
2. **Create UI for business info** - Build forms for managing services, pricing, hours
3. **Add API endpoints** - Expose business info management via REST API
4. **Test with real data** - Verify with actual business profiles and calendar data
5. **Monitor token usage** - Ensure business info doesn't exceed token limits

## Notes

- ✅ All existing categories preserved (no changes)
- ✅ No breaking changes to existing APIs
- ✅ Backward compatible (feature flags control enablement)
- ✅ Uses existing calendar integration (`sync_calendar_events`)
- ✅ Works with existing thread-aware drafts (Phase 2)
- ✅ Website knowledge is optional (stub ready for extension)

---

**Implementation Status:** ✅ Complete and Ready for Testing


