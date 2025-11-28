# Twilio Integration Implementation Summary

This document summarizes the complete Twilio integration for Aloha voice agent, including mock mode support for development without Twilio credentials.

## Overview

The integration provides:
- **One Twilio number per user** (enforced at application level)
- **Number search and random selection** (with area code filtering)
- **Number purchase and release** (with mock mode support)
- **Aloha as Voicemail** with call forwarding support
- **Inbound/outbound call webhooks** (skeleton for OpenAI Realtime integration)

## Database Schema

### `user_phone_numbers` Table

Created in `supabase/migrations/20241205000000_user_phone_numbers.sql`:

- `id` (UUID, PK)
- `user_id` (UUID, FK to auth.users)
- `twilio_phone_sid` (TEXT) - Twilio SID or "SIMULATED_SID_*" in mock mode
- `phone_number` (TEXT) - E.164 format
- `country` (TEXT, default "US")
- `area_code` (TEXT, nullable)
- `is_active` (BOOLEAN, default true) - Only one active per user
- `voicemail_enabled` (BOOLEAN, default false)
- `voicemail_mode` (TEXT) - 'none' | 'voicemail_only' | 'receptionist'
- `external_phone_number` (TEXT, nullable) - User's real SIM/carrier number
- `forwarding_enabled` (BOOLEAN, default false)
- `forwarding_confirmed` (BOOLEAN, default false)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**One active number per user** is enforced at the application level (not database constraint).

## Backend Components

### 1. Twilio Client Helper (`lib/twilioClient.ts`)

**Mock Mode Detection:**
- Checks for `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` environment variables
- If missing, operates in mock mode (no real Twilio calls)

**Functions:**
- `searchAvailableNumbers(country, areaCode)` - Search for available numbers
- `purchasePhoneNumber(phoneNumber, voiceUrl)` - Purchase a number
- `releasePhoneNumber(twilioPhoneSid)` - Release a number
- `makeOutboundCall(from, to, url)` - Make an outbound call

**TODO:** Install Twilio SDK: `npm install twilio`
**TODO:** Uncomment real Twilio SDK code when credentials are configured

### 2. API Endpoints

#### Number Management

**GET `/api/telephony/twilio/available-numbers`**
- Query params: `country` (default "US"), `areaCode` (optional)
- Returns: Array of available phone numbers
- Error if user already has active number

**GET `/api/telephony/twilio/random-number`**
- Query params: `country`, `areaCode` (optional)
- Returns: Single random available number
- Error if user already has active number

**POST `/api/telephony/twilio/purchase-number`**
- Body: `{ phoneNumber, country, areaCode? }`
- Deactivates existing active number
- Purchases number (or simulates in mock mode)
- Creates `user_phone_numbers` record

**POST `/api/telephony/twilio/release-number`**
- Deactivates user's active number
- Releases from Twilio (or simulates in mock mode)
- Resets voicemail and forwarding flags

**GET `/api/telephony/twilio/active-number`**
- Returns user's active phone number record

#### Voicemail Settings

**PATCH `/api/telephony/voicemail/settings`**
- Body: `{ externalPhoneNumber?, voicemailEnabled?, voicemailMode?, forwardingEnabled?, forwardingConfirmed? }`
- Requires active Twilio number for voicemail/forwarding
- Auto-disables forwarding if voicemail is disabled

#### Call Webhooks

**POST `/api/twilio/voice/incoming`**
- Twilio webhook for inbound calls
- Identifies user by phone number
- Determines call type (voicemail vs live)
- Returns TwiML to start media stream
- **TODO:** Add Twilio signature validation

**POST `/api/twilio/voice/outbound`**
- Body: `{ phoneNumber, campaignId? }`
- Requires active Twilio number (caller ID)
- Creates outbound call (or simulates in mock mode)

## Frontend Components

### 1. Aloha Settings Page (`app/aloha/settings/page.tsx`)

**Sections:**

1. **Phone Number Selection**
   - If no active number:
     - Country and area code inputs
     - "Search Numbers" button
     - "Random Number" button
     - List of available numbers with "Use this number" buttons
   - If active number exists:
     - Display active number
     - "Release Number" button

2. **Aloha as Voicemail**
   - External phone number input (user's real number)
   - Toggle: "Enable Aloha as my voicemail"
   - Call forwarding checkbox (only when voicemail enabled)
   - "How do I set this up?" button → opens modal
   - Status indicator: "Forwarding marked as set up" or "Forwarding not yet confirmed"

3. **Agent Name** (existing)
4. **Voice Selection** (existing)

### 2. Call Forwarding Modal (`components/modals/CallForwardingModal.tsx`)

**Features:**
- Displays user's Aloha/Twilio number
- Explanation of call forwarding concept
- Step-by-step instructions (generic, works for most phones)
- "Copy number" button (copies to clipboard)
- "I've set up forwarding" button → sets `forwarding_confirmed = true`
- "Close" button

## Environment Variables

Required for real Twilio mode:
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token

Optional:
- `NEXT_PUBLIC_BASE_URL` - Base URL for webhooks (defaults to Vercel URL or localhost)

## Mock Mode Behavior

When Twilio credentials are missing:

1. **Number Search:** Generates 5-10 fake phone numbers
2. **Number Purchase:** Creates record with `twilio_phone_sid = "SIMULATED_SID_*"`
3. **Number Release:** Just deactivates in database (no Twilio API call)
4. **Outbound Calls:** Logs to console, returns simulated call SID

## Integration Points

### For OpenAI Realtime Integration

The webhook endpoints are ready for integration:

1. **Inbound Calls:** `/api/twilio/voice/incoming` returns TwiML with Stream URL pointing to:
   - `/api/twilio/voice/stream?userId=...&callType=...&from=...&callSid=...`

2. **Outbound Calls:** `/api/twilio/voice/outbound` initiates call, which then hits `/api/twilio/voice/incoming`

**Next Steps:**
- Create `/api/twilio/voice/stream` endpoint for WebSocket connection
- Connect to OpenAI Realtime API
- Pass `callType` ("voicemail" vs "live") to Aloha conversation logic

## Security Notes

1. **Twilio Signature Validation:** TODO in `/api/twilio/voice/incoming`
   - Should validate `x-twilio-signature` header
   - See: https://www.twilio.com/docs/usage/webhooks/webhooks-security

2. **Authentication:** All endpoints (except webhooks) require authentication via `requireAuthFromRequest()`

3. **RLS Policies:** Database has Row Level Security enabled for `user_phone_numbers`

## Testing

### Mock Mode Testing
1. Don't set `TWILIO_ACCOUNT_SID` or `TWILIO_AUTH_TOKEN`
2. All operations will work in mock mode
3. Numbers will have `SIMULATED_SID_*` prefixes

### Real Twilio Testing
1. Set environment variables
2. Install Twilio SDK: `npm install twilio`
3. Uncomment real Twilio code in `lib/twilioClient.ts`
4. Test with real Twilio account

## Files Created/Modified

### Database
- `supabase/migrations/20241205000000_user_phone_numbers.sql`

### Backend
- `lib/twilioClient.ts` (new)
- `app/api/telephony/twilio/available-numbers/route.ts` (new)
- `app/api/telephony/twilio/random-number/route.ts` (new)
- `app/api/telephony/twilio/purchase-number/route.ts` (new)
- `app/api/telephony/twilio/release-number/route.ts` (new)
- `app/api/telephony/twilio/active-number/route.ts` (new)
- `app/api/telephony/voicemail/settings/route.ts` (new)
- `app/api/twilio/voice/incoming/route.ts` (new)
- `app/api/twilio/voice/outbound/route.ts` (new)

### Frontend
- `components/modals/CallForwardingModal.tsx` (new)
- `app/aloha/settings/page.tsx` (new - replaces deleted file)

### Types
- `types/database.ts` (updated with `UserPhoneNumber` interface)

## Usage Flow

1. **User selects number:**
   - Searches or gets random number
   - Clicks "Use this number"
   - Number is purchased and assigned

2. **User enables voicemail:**
   - Enters external phone number
   - Toggles "Enable Aloha as my voicemail"
   - Saves settings

3. **User sets up forwarding:**
   - Checks "I'll use call forwarding"
   - Clicks "How do I set this up?"
   - Follows instructions in modal
   - Clicks "I've set up forwarding"

4. **Incoming calls:**
   - Twilio webhook hits `/api/twilio/voice/incoming`
   - System identifies user and call type
   - Returns TwiML to start media stream
   - Aloha handles conversation based on `callType`

## Next Steps

1. **Install Twilio SDK:** `npm install twilio`
2. **Configure environment variables** when ready for production
3. **Uncomment real Twilio code** in `lib/twilioClient.ts`
4. **Add Twilio signature validation** to webhook endpoints
5. **Create WebSocket stream endpoint** for OpenAI Realtime integration
6. **Test end-to-end** with real Twilio account










