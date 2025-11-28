-- Aloha Voicemail Feature
-- Adds voicemail mode support for external phone numbers

-- Create user_phone_numbers table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL, -- Twilio number (E.164 format)
  external_phone_number TEXT, -- User's real SIM/carrier number (nullable)
  voicemail_enabled BOOLEAN NOT NULL DEFAULT false,
  voicemail_mode TEXT NOT NULL DEFAULT 'none' CHECK (voicemail_mode IN ('none', 'voicemail_only', 'receptionist')),
  forwarding_enabled BOOLEAN NOT NULL DEFAULT false,
  forwarding_confirmed BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  twilio_phone_sid TEXT, -- Twilio Phone Number SID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_phone_number ON user_phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_user_id ON user_phone_numbers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_active ON user_phone_numbers(user_id, is_active) WHERE is_active = true;

-- Add comments
COMMENT ON TABLE user_phone_numbers IS 'Stores Twilio phone numbers assigned to users. Supports voicemail mode for external phone forwarding.';
COMMENT ON COLUMN user_phone_numbers.phone_number IS 'Twilio number in E.164 format (e.g., +15551234567)';
COMMENT ON COLUMN user_phone_numbers.external_phone_number IS 'User''s real SIM/carrier number that forwards to the Twilio number';
COMMENT ON COLUMN user_phone_numbers.voicemail_enabled IS 'Whether voicemail mode is enabled for this number';
COMMENT ON COLUMN user_phone_numbers.voicemail_mode IS 'Voicemail mode: none, voicemail_only, or receptionist';
COMMENT ON COLUMN user_phone_numbers.forwarding_enabled IS 'Whether user has enabled call forwarding';
COMMENT ON COLUMN user_phone_numbers.forwarding_confirmed IS 'Whether user has confirmed they set up forwarding';
COMMENT ON COLUMN user_phone_numbers.is_active IS 'Whether this is the active number for the user (only one active per user)';

-- Function to automatically disable voicemail when number is released
CREATE OR REPLACE FUNCTION disable_voicemail_on_number_release()
RETURNS TRIGGER AS $$
BEGIN
  -- When a number is deactivated, disable voicemail and forwarding
  IF OLD.is_active = true AND NEW.is_active = false THEN
    NEW.voicemail_enabled = false;
    NEW.forwarding_enabled = false;
    NEW.forwarding_confirmed = false;
    NEW.external_phone_number = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to disable voicemail when number is released
CREATE TRIGGER trigger_disable_voicemail_on_release
  BEFORE UPDATE ON user_phone_numbers
  FOR EACH ROW
  WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
  EXECUTE FUNCTION disable_voicemail_on_number_release();

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION update_user_phone_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_phone_numbers_updated_at
  BEFORE UPDATE ON user_phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION update_user_phone_numbers_updated_at();

-- RLS policies
ALTER TABLE user_phone_numbers ENABLE ROW LEVEL SECURITY;

-- Users can only see their own phone numbers
CREATE POLICY "Users can view their own phone numbers"
  ON user_phone_numbers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own phone numbers
CREATE POLICY "Users can insert their own phone numbers"
  ON user_phone_numbers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own phone numbers
CREATE POLICY "Users can update their own phone numbers"
  ON user_phone_numbers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own phone numbers
CREATE POLICY "Users can delete their own phone numbers"
  ON user_phone_numbers
  FOR DELETE
  USING (auth.uid() = user_id);








