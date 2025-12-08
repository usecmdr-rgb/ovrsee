# Business Info + Smart Scheduling - Verification Guide

## Quick Start

1. **Run migrations:**
   ```bash
   # Apply the new migrations
   supabase migration up
   ```

2. **Set environment variables:**
   ```bash
   BUSINESS_INFO_AWARE_DRAFTS_ENABLED=true
   SMART_SCHEDULING_SUGGESTIONS_ENABLED=true
   BUSINESS_WEBSITE_CONTEXT_ENABLED=true  # Optional
   ```

3. **Set up business info** (see below)

4. **Test draft generation**

## Step-by-Step Verification

### 1. Set Up Business Info

#### Option A: Via SQL (Quick Test)

```sql
-- Replace 'your-user-id' with actual user ID
-- Get your user ID: SELECT id FROM auth.users WHERE email = 'your@email.com';

-- 1. Create business profile
INSERT INTO business_profiles (user_id, business_name, website_url, description, brand_voice)
VALUES (
  'your-user-id',
  'Acme Consulting',
  'https://acme.com',
  'We provide expert consulting services for businesses',
  'professional'
)
ON CONFLICT (user_id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  website_url = EXCLUDED.website_url,
  description = EXCLUDED.description,
  brand_voice = EXCLUDED.brand_voice;

-- 2. Get business_id
-- Note this ID for next steps
SELECT id FROM business_profiles WHERE user_id = 'your-user-id';

-- 3. Add services (replace 'business-id' with actual ID)
INSERT INTO business_services (business_id, name, description, category)
VALUES 
  ('business-id', 'Business Consulting', 'Strategic business consulting services', 'Consulting'),
  ('business-id', 'Training Programs', 'Professional development training', 'Training'),
  ('business-id', 'Implementation Support', 'Technical implementation and support', 'Support')
ON CONFLICT DO NOTHING;

-- 4. Add pricing tiers (replace 'business-id' and service IDs)
-- Get service IDs first:
SELECT id, name FROM business_services WHERE business_id = 'business-id';

-- Then insert pricing:
INSERT INTO business_pricing_tiers (business_id, service_id, name, description, price_amount, price_currency, billing_interval)
VALUES 
  ('business-id', 'service-id-1', 'Starter Plan', 'Basic consulting package', 99.00, 'USD', 'monthly'),
  ('business-id', 'service-id-1', 'Professional Plan', 'Full consulting package', 199.00, 'USD', 'monthly'),
  ('business-id', 'service-id-1', 'Enterprise Plan', 'Custom enterprise solution', 499.00, 'USD', 'monthly')
ON CONFLICT DO NOTHING;

-- 5. Set business hours (Monday-Friday, 9 AM - 5 PM)
INSERT INTO business_hours (business_id, day_of_week, open_time, close_time, timezone, is_closed)
VALUES 
  ('business-id', 0, NULL, NULL, 'America/New_York', true),  -- Sunday (closed)
  ('business-id', 1, '09:00:00', '17:00:00', 'America/New_York', false),  -- Monday
  ('business-id', 2, '09:00:00', '17:00:00', 'America/New_York', false),  -- Tuesday
  ('business-id', 3, '09:00:00', '17:00:00', 'America/New_York', false),  -- Wednesday
  ('business-id', 4, '09:00:00', '17:00:00', 'America/New_York', false),  -- Thursday
  ('business-id', 5, '09:00:00', '17:00:00', 'America/New_York', false),  -- Friday
  ('business-id', 6, NULL, NULL, 'America/New_York', true)  -- Saturday (closed)
ON CONFLICT (business_id, day_of_week) DO UPDATE SET
  open_time = EXCLUDED.open_time,
  close_time = EXCLUDED.close_time,
  timezone = EXCLUDED.timezone,
  is_closed = EXCLUDED.is_closed;

-- 6. Add FAQs (optional)
INSERT INTO business_faqs (business_id, question, answer)
VALUES 
  ('business-id', 'What is your cancellation policy?', 'We require 24 hours notice for cancellations.'),
  ('business-id', 'Do you offer refunds?', 'Yes, we offer full refunds within 30 days of purchase.')
ON CONFLICT DO NOTHING;
```

#### Option B: Via API (Future)

Create API endpoints that use `lib/sync/businessInfo.ts` functions:
- `POST /api/sync/business/profile` - Upsert profile
- `POST /api/sync/business/services` - Manage services
- `POST /api/sync/business/pricing` - Manage pricing
- `POST /api/sync/business/hours` - Set hours
- `POST /api/sync/business/faqs` - Manage FAQs

### 2. Test Business-Aware Drafts

**Test Case 1: Pricing Inquiry**

1. **Setup:**
   - Ensure business profile and pricing tiers exist
   - Set `BUSINESS_INFO_AWARE_DRAFTS_ENABLED=true`

2. **Action:**
   - Open Sync
   - Select or create an email with subject: "Pricing Inquiry"
   - Body: "Hi, I'm interested in your consulting services. What are your pricing options?"
   - Generate draft

3. **Verify:**
   - ✅ Draft includes specific pricing from `business_pricing_tiers`
   - ✅ Draft references services from `business_services`
   - ✅ Draft matches brand voice (professional, friendly, etc.)
   - ✅ Draft does NOT invent prices

**Test Case 2: Service Inquiry**

1. **Action:**
   - Email: "What services do you offer?"
   - Generate draft

2. **Verify:**
   - ✅ Draft lists services from `business_services`
   - ✅ Draft includes relevant pricing when appropriate
   - ✅ Draft matches business description

**Test Case 3: Hours/Policy Question**

1. **Action:**
   - Email: "What are your business hours?"
   - Generate draft

2. **Verify:**
   - ✅ Draft includes business hours from `business_hours`
   - ✅ Draft references FAQs if relevant

### 3. Test Smart Scheduling

**Test Case 1: Scheduling Request with Available Slots**

1. **Setup:**
   - Ensure:
     - Business hours are set
     - Calendar is connected
     - Some free time exists in calendar
   - Set `SMART_SCHEDULING_SUGGESTIONS_ENABLED=true`

2. **Action:**
   - Email: "Can we schedule a demo call next week?"
   - Generate draft

3. **Verify:**
   - ✅ Draft includes 2-3 specific time slots
   - ✅ Slots are within business hours
   - ✅ Slots exclude busy calendar times
   - ✅ Times are formatted clearly (e.g., "Monday, January 27 at 2:00 PM - 3:00 PM")

**Test Case 2: No Available Slots**

1. **Setup:**
   - Ensure calendar is fully booked for next 7 days

2. **Action:**
   - Email: "Can we schedule a call?"
   - Generate draft

3. **Verify:**
   - ✅ Draft politely explains fully booked
   - ✅ Draft suggests checking back later
   - ✅ Draft does NOT invent fake time slots

**Test Case 3: Scheduling with Business Hours**

1. **Setup:**
   - Set business hours: Monday-Friday, 9 AM - 5 PM
   - Ensure calendar has events outside business hours

2. **Action:**
   - Email: "Let's schedule a meeting"
   - Generate draft

3. **Verify:**
   - ✅ Suggested slots are within 9 AM - 5 PM
   - ✅ No slots on weekends (if closed)
   - ✅ No slots outside business hours

### 4. Test End-to-End Flow

**Scenario:** Client asks about pricing and scheduling

1. **Email:**
   ```
   Subject: Pricing and Demo Request
   Body: Hi, I'm interested in your consulting services. What are your pricing options? Also, can we schedule a demo call next week?
   ```

2. **Expected Behavior:**
   - Phase 1: Email classified, appointment intent detected
   - Draft generation:
     - Loads business services and pricing
     - Loads available time slots
     - Generates reply with:
       - Accurate pricing details
       - 2-3 specific time slot options
   - User sends draft
   - Phase 2: Calendar event/reminder created

3. **Verify:**
   - ✅ Draft includes correct pricing
   - ✅ Draft includes real available time slots
   - ✅ Calendar event created on send

### 5. Test Feature Flags

**Test with BUSINESS_INFO_AWARE_DRAFTS_ENABLED=false:**
1. Set flag to `false`
2. Generate draft for pricing inquiry
3. **Verify:** Draft works but doesn't include business info (falls back to generic)

**Test with SMART_SCHEDULING_SUGGESTIONS_ENABLED=false:**
1. Set flag to `false`
2. Generate draft for scheduling request
3. **Verify:** Draft works but doesn't include time slots

**Test with both flags enabled:**
1. Set both flags to `true`
2. Generate draft for combined pricing + scheduling email
3. **Verify:** Draft includes both business info and time slots

### 6. Test User Preferences

**Test scheduling preferences:**

```sql
-- Update user preferences
UPDATE user_sync_preferences
SET 
  prefers_auto_time_suggestions = true,
  default_meeting_duration_minutes = 30,  -- 30-minute meetings
  scheduling_time_window_days = 14  -- Look 14 days ahead
WHERE user_id = 'your-user-id';
```

1. Generate draft for scheduling request
2. **Verify:** Slots are 30 minutes long, within 14-day window

### 7. Test Edge Cases

**No Business Profile:**
1. Delete business profile (or use user without one)
2. Generate draft
3. **Verify:** Draft works normally (no business info, no errors)

**No Pricing:**
1. Remove all pricing tiers
2. Generate draft for pricing inquiry
3. **Verify:** Draft offers custom quote instead of inventing prices

**No Business Hours:**
1. Remove all business hours entries
2. Generate draft for scheduling
3. **Verify:** Uses default 9 AM - 5 PM hours

**No Calendar Events:**
1. Ensure calendar has no events
2. Generate draft for scheduling
3. **Verify:** All slots within business hours are available

## Debugging

### Check Business Info

```sql
-- Verify business profile exists
SELECT * FROM business_profiles WHERE user_id = 'your-user-id';

-- Check services
SELECT * FROM business_services WHERE business_id = 'business-id';

-- Check pricing
SELECT * FROM business_pricing_tiers WHERE business_id = 'business-id';

-- Check hours
SELECT * FROM business_hours WHERE business_id = 'business-id' ORDER BY day_of_week;
```

### Check Calendar Events

```sql
-- Get workspace_id
SELECT id FROM workspaces WHERE owner_user_id = 'your-user-id';

-- Check calendar events
SELECT * FROM sync_calendar_events 
WHERE workspace_id = 'workspace-id'
AND start_at >= NOW()
ORDER BY start_at;
```

### Check User Preferences

```sql
SELECT * FROM user_sync_preferences WHERE user_id = 'your-user-id';
```

### Check Logs

```bash
# Look for business info logs
grep "BusinessInfo" logs
grep "SmartScheduling" logs
grep "GenerateDraft" logs
```

## Common Issues

### Issue: Draft doesn't include business info

**Possible Causes:**
1. Feature flag not enabled
2. Business profile doesn't exist
3. Error loading business info (check logs)

**Solution:**
- Verify `BUSINESS_INFO_AWARE_DRAFTS_ENABLED=true`
- Check business profile exists: `SELECT * FROM business_profiles WHERE user_id = '...'`
- Check error logs

### Issue: No time slots suggested

**Possible Causes:**
1. Feature flag not enabled
2. No appointment intent detected
3. No available slots in time window
4. Calendar not connected

**Solution:**
- Verify `SMART_SCHEDULING_SUGGESTIONS_ENABLED=true`
- Check appointment detection worked (Phase 1)
- Verify calendar is connected and synced
- Check business hours are set
- Try extending time window

### Issue: Time slots outside business hours

**Possible Causes:**
1. Business hours not set correctly
2. Timezone mismatch

**Solution:**
- Verify business hours: `SELECT * FROM business_hours WHERE business_id = '...'`
- Check timezone matches calendar timezone

### Issue: Draft invents prices

**Possible Causes:**
1. Business info not loaded
2. Pricing tiers missing

**Solution:**
- Verify business profile exists
- Check pricing tiers: `SELECT * FROM business_pricing_tiers WHERE business_id = '...'`
- Ensure feature flag is enabled

---

**Ready for Testing**

Follow the steps above to verify all features are working correctly.


