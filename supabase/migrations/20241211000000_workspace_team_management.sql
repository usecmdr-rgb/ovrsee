-- Workspace and Team Management System
-- This migration creates tables for multi-user team management with seat-based pricing

-- Workspaces table
-- Each user can own/be part of a workspace (for now, each user gets their own workspace)
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(owner_user_id)
);

-- Workspace seats table
-- Tracks who has access to a workspace and at what tier
CREATE TABLE IF NOT EXISTS workspace_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT, -- For pending invites where user doesn't exist yet
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'advanced', 'elite')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'removed')),
  is_owner BOOLEAN DEFAULT FALSE, -- Track workspace owner
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id) -- One seat per user per workspace
);

-- Workspace invites table
-- Tracks pending invitations with invite codes
CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  seat_id UUID REFERENCES workspace_seats(id) ON DELETE CASCADE,
  email TEXT, -- Optional: if provided, invite is email-specific
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'advanced', 'elite')),
  invite_code TEXT NOT NULL UNIQUE, -- Short unique code for invite links
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_user_id ON workspaces(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_seats_workspace_id ON workspace_seats(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_seats_user_id ON workspace_seats(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_seats_status ON workspace_seats(status);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_id ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_invite_code ON workspace_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(email);

-- RLS Policies
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

-- Workspaces policies
CREATE POLICY "Users can view their own workspace"
  ON workspaces FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert their own workspace"
  ON workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update their own workspace"
  ON workspaces FOR UPDATE
  USING (auth.uid() = owner_user_id);

-- Workspace seats policies
CREATE POLICY "Users can view seats in their workspace"
  ON workspace_seats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_seats.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Workspace owners can manage seats"
  ON workspace_seats FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_seats.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
  );

-- Workspace invites policies
CREATE POLICY "Users can view invites for their workspace"
  ON workspace_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_invites.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Workspace owners can manage invites"
  ON workspace_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_invites.workspace_id
      AND workspaces.owner_user_id = auth.uid()
    )
  );

-- Function to auto-create workspace for new users
CREATE OR REPLACE FUNCTION create_workspace_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspaces (owner_user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'My Workspace'))
  ON CONFLICT (owner_user_id) DO NOTHING;
  
  -- Create owner seat
  INSERT INTO workspace_seats (workspace_id, user_id, tier, status, is_owner)
  SELECT id, NEW.id, 'basic', 'active', TRUE
  FROM workspaces
  WHERE owner_user_id = NEW.id
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create workspace when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_workspace_for_user();




