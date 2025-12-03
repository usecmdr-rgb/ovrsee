-- Track user phone number change events (not initial assignments)

CREATE TABLE IF NOT EXISTS user_phone_number_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_phone_number TEXT,
  new_phone_number TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_phone_number_changes_user_id_changed_at
  ON user_phone_number_changes (user_id, changed_at);




