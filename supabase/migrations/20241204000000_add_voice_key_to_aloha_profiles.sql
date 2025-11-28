-- Add voice_key column to aloha_profiles table
-- This stores which of the 4 voice profiles the user has selected

ALTER TABLE aloha_profiles
ADD COLUMN IF NOT EXISTS voice_key TEXT;

-- Set default voice_key for existing profiles
UPDATE aloha_profiles
SET voice_key = 'aloha_voice_friendly_female_us'
WHERE voice_key IS NULL;

-- Set default for new profiles
ALTER TABLE aloha_profiles
ALTER COLUMN voice_key SET DEFAULT 'aloha_voice_friendly_female_us';

-- Add comment
COMMENT ON COLUMN aloha_profiles.voice_key IS 'Selected voice profile key (one of 4 predefined Aloha voice profiles)';








