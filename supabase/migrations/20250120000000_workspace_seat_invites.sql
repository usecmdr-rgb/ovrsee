-- Workspace Seat Invites Table
-- New table for token-based seat invitations with email activation flow
-- This complements the existing workspace_invites table

CREATE TABLE IF NOT EXISTS workspace_seat_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  plan_code TEXT CHECK (plan_code IN ('essentials', 'professional', 'executive')),
  tier TEXT CHECK (tier IN ('basic', 'advanced', 'elite')), -- For backward compatibility
  invite_token TEXT NOT NULL UNIQUE, -- Secure random token (32+ bytes)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_seat_invites_workspace_id ON workspace_seat_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_seat_invites_invite_token ON workspace_seat_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_workspace_seat_invites_invited_email ON workspace_seat_invites(invited_email);
CREATE INDEX IF NOT EXISTS idx_workspace_seat_invites_status ON workspace_seat_invites(status);

-- RLS Policies
ALTER TABLE workspace_seat_invites ENABLE ROW LEVEL SECURITY;

-- Workspace owners can view invites for their workspace
CREATE POLICY "Workspace owners can view seat invites"
  ON workspace_seat_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_seat_invites.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
  );

-- Users can view invites sent to their email
CREATE POLICY "Users can view invites for their email"
  ON workspace_seat_invites FOR SELECT
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Workspace owners can manage invites
CREATE POLICY "Workspace owners can manage seat invites"
  ON workspace_seat_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_seat_invites.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
  );

-- Users can update invites sent to their email (to accept them)
CREATE POLICY "Users can accept invites for their email"
  ON workspace_seat_invites FOR UPDATE
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Function to automatically expire invites past their expiration date
CREATE OR REPLACE FUNCTION expire_workspace_seat_invites()
RETURNS void AS $$
BEGIN
  UPDATE workspace_seat_invites
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a scheduled job to run this function periodically
-- This would typically be done via pg_cron or a similar extension
-- For now, we'll rely on application-level checks


