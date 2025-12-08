# Aloha Voice Selection System Implementation

## Overview

Implemented a voice selection system for Aloha that allows users to choose from 4 distinct voice profiles. Aloha's personality and behavior remain the same; only the voice (tone, accent, gender) changes.

## Implementation Summary

### 1. Voice Profiles Definition

**File:** `lib/aloha/voice-profiles.ts`

Defined 4 voice profiles, each mapping to:
- OpenAI TTS voice ID
- Tone preset (friendly/professional/empathetic/energetic)
- Label and description for UI

```typescript
export const ALOHA_VOICE_PROFILES: AlohaVoiceProfile[] = [
  {
    key: "aloha_voice_friendly_female_us",
    label: "Friendly (Female, US)",
    description: "Warm and approachable, ideal for feedback and general calls.",
    openaiVoiceId: "nova",
    tonePreset: "friendly",
    gender: "female",
    accent: "US",
  },
  {
    key: "aloha_voice_professional_male_us",
    label: "Professional (Male, US)",
    description: "Clear and confident, great for confirmations and updates.",
    openaiVoiceId: "onyx",
    tonePreset: "professional",
    gender: "male",
    accent: "US",
  },
  {
    key: "aloha_voice_energetic_female_uk",
    label: "Energetic (Female, UK)",
    description: "Lively and upbeat, perfect for sales or promotions.",
    openaiVoiceId: "shimmer",
    tonePreset: "energetic",
    gender: "female",
    accent: "UK",
  },
  {
    key: "aloha_voice_empathetic_male_neutral",
    label: "Empathetic (Male, Neutral)",
    description: "Calm and reassuring, ideal for sensitive or support calls.",
    openaiVoiceId: "echo",
    tonePreset: "empathetic",
    gender: "male",
    accent: "Neutral",
  },
];
```

### 2. Database Schema Update

**File:** `supabase/migrations/20241204000000_add_voice_key_to_aloha_profiles.sql`

Added `voice_key` column to `aloha_profiles` table:

```sql
ALTER TABLE aloha_profiles
ADD COLUMN IF NOT EXISTS voice_key TEXT;

UPDATE aloha_profiles
SET voice_key = 'aloha_voice_friendly_female_us'
WHERE voice_key IS NULL;

ALTER TABLE aloha_profiles
ALTER COLUMN voice_key SET DEFAULT 'aloha_voice_friendly_female_us';
```

### 3. Settings UI with 4 Voice Buttons

**File:** `app/aloha/settings/page.tsx`

Updated the settings page to:
- Display 4 voice profile cards (replacing old voice selection)
- Show label, description, gender, accent, and tone preset
- Highlight selected voice with checkmark
- Include "Preview" button for each voice
- Save `voice_key` instead of `voice_id`

**Key Changes:**
- Replaced `getAllVoices()` with `getAllVoiceProfiles()`
- Changed state from `selectedVoiceId` to `selectedVoiceKey`
- Updated API calls to use `voice_key` parameter
- Added voice preview functionality

### 4. Voice Preview API Endpoint

**File:** `app/api/aloha/voice-preview/route.ts`

Created endpoint that:
- Accepts `voice_key` in request body
- Generates TTS preview using OpenAI TTS with the selected voice
- Returns audio as base64 data URL
- Uses preview text: "Hi, I'm Aloha. This is how I'll sound when I speak with your customers."

**Usage:**
```typescript
POST /api/aloha/voice-preview
Body: { voice_key: "aloha_voice_friendly_female_us" }
Response: { ok: true, audioUrl: "data:audio/mp3;base64,..." }
```

### 5. Profile Management Updates

**File:** `lib/aloha/profile.ts`

Updated to:
- Support `voice_key` field in `AlohaProfile` interface
- Add `getAlohaVoiceProfile()` function to get voice profile by user ID
- Default to `DEFAULT_VOICE_KEY` when no voice is selected
- Maintain backward compatibility with `voice_id` field

**New Function:**
```typescript
export async function getAlohaVoiceProfile(
  userId: string
): Promise<AlohaVoiceProfile> {
  const profile = await getAlohaProfile(userId);
  const voiceKey = profile?.voice_key || DEFAULT_VOICE_KEY;
  return getVoiceProfileByKey(voiceKey);
}
```

### 6. TTS Integration

**File:** `lib/aloha/tts.ts`

Updated TTS functions to:
- Accept `voiceProfile` parameter (new system)
- Use `voiceProfile.openaiVoiceId` for OpenAI TTS voice selection
- Apply tone preset settings (rate, pitch) from voice profile
- Maintain backward compatibility with legacy `voice` parameter

**Key Changes:**
- `generateSpeech()` now accepts `voiceProfile` and uses OpenAI TTS API
- `streamSpeech()` now accepts `voiceProfile` and streams using selected voice
- Tone preset settings are automatically applied based on voice profile

### 7. Call Handler Integration

**File:** `lib/aloha/call-handler.ts`

Updated to:
- Load voice profile using `getAlohaVoiceProfile()`
- Pass voice profile to TTS functions
- Use voice profile's OpenAI voice ID for all speech generation

**File:** `lib/aloha/filler-speech.ts`

Updated to:
- Use voice profile for filler speech generation
- Maintain consistency across all Aloha speech output

**File:** `lib/aloha/enhanced-call-handler.ts`

Updated to:
- Load tone preset from voice profile automatically
- Use voice profile's tone preset for response shaping

### 8. API Route Updates

**File:** `app/api/aloha/profile/route.ts`

Updated to:
- Accept `voice_key` in PATCH requests
- Validate `voice_key` against available voice profiles
- Store `voice_key` in database

## Files Modified

1. **lib/aloha/voice-profiles.ts** (NEW)
   - Voice profile definitions
   - Helper functions for voice profile management

2. **supabase/migrations/20241204000000_add_voice_key_to_aloha_profiles.sql** (NEW)
   - Database migration for voice_key column

3. **app/aloha/settings/page.tsx**
   - Updated UI to show 4 voice profile buttons
   - Added preview functionality
   - Changed to use voice_key instead of voice_id

4. **app/api/aloha/voice-preview/route.ts** (NEW)
   - Voice preview endpoint using OpenAI TTS

5. **app/api/aloha/profile/route.ts**
   - Updated to handle voice_key parameter

6. **lib/aloha/profile.ts**
   - Added getAlohaVoiceProfile() function
   - Updated to support voice_key field

7. **lib/aloha/tts.ts**
   - Updated to use voice profiles
   - Integrated OpenAI TTS API calls
   - Applied tone preset settings

8. **lib/aloha/call-handler.ts**
   - Updated to use voice profiles for TTS

9. **lib/aloha/filler-speech.ts**
   - Updated to use voice profiles

10. **lib/aloha/enhanced-call-handler.ts**
    - Updated to load tone preset from voice profile

11. **types/database.ts**
    - Added voice_key field to AlohaProfile interface

## How It Works

### User Flow

1. User navigates to Aloha Settings (`/aloha/settings`)
2. Sees 4 voice profile cards with descriptions
3. Clicks "Preview" to hear a sample
4. Clicks "Select" to choose a voice
5. Clicks "Save Settings" to persist selection
6. `voice_key` is saved to `aloha_profiles` table

### Call Flow

1. When a call starts, system loads user's Aloha profile
2. Gets `voice_key` from profile (defaults if not set)
3. Maps `voice_key` to `AlohaVoiceProfile`
4. Uses `voiceProfile.openaiVoiceId` for OpenAI TTS
5. Applies `voiceProfile.tonePreset` for response shaping
6. All speech (responses, filler, previews) uses selected voice

### Voice Profile Selection

```typescript
// Load profile
const profile = await getAlohaProfile(userId);

// Get voice profile
const voiceProfile = getVoiceProfileByKey(profile.voice_key || DEFAULT_VOICE_KEY);

// Use in TTS
const audio = await generateSpeech({
  voiceProfile,
  text: "Hello, how can I help you?",
});
```

## OpenAI TTS Voice Mapping

| Voice Profile | OpenAI Voice ID | Tone Preset | Gender | Accent |
|--------------|-----------------|-------------|--------|--------|
| Friendly (Female, US) | `nova` | friendly | female | US |
| Professional (Male, US) | `onyx` | professional | male | US |
| Energetic (Female, UK) | `shimmer` | energetic | female | UK |
| Empathetic (Male, Neutral) | `echo` | empathetic | male | Neutral |

## Important Notes

### Same Agent, Different Voice

- Aloha's **personality** stays the same (same name, same behavior rules)
- Aloha's **logic** stays the same (same LLM prompts, same decision-making)
- Only the **voice** changes (TTS voice, tone preset, accent, gender)

### Backward Compatibility

- Legacy `voice_id` field is still supported
- Old code using `getAlohaVoice()` still works
- New code should use `getAlohaVoiceProfile()`

### Default Behavior

- If no `voice_key` is set, defaults to `aloha_voice_friendly_female_us`
- Migration sets default for existing profiles
- New profiles automatically get default voice

## Testing

To test the voice selection system:

1. **Settings UI:**
   - Navigate to `/aloha/settings`
   - Verify 4 voice cards are displayed
   - Test "Preview" button for each voice
   - Test "Select" and "Save" functionality

2. **Voice Preview:**
   - Click "Preview" on any voice
   - Verify audio plays correctly
   - Verify correct OpenAI voice is used

3. **Voice Persistence:**
   - Select a voice and save
   - Refresh page
   - Verify selected voice is highlighted

4. **Call Integration:**
   - Make a test call
   - Verify selected voice is used in TTS
   - Verify tone preset is applied correctly

## Future Enhancements

Potential improvements:
1. Add more voice profiles (expand beyond 4)
2. Custom voice settings (adjust rate/pitch per profile)
3. Voice preview with custom text
4. Voice analytics (which voices perform best)
5. A/B testing different voices














