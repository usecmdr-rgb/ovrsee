-- Fix: The workspace migration replaced the user creation trigger
-- This migration ensures profiles, subscriptions, AND workspaces are all created

-- Update the workspace creation function to also create profile and subscription
CREATE OR REPLACE FUNCTION create_workspace_for_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile (if it doesn't exist)
  INSERT INTO public.profiles (id, email, full_name, subscription_tier, subscription_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'free',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create default free subscription (if it doesn't exist)
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  -- Create workspace (if it doesn't exist)
  INSERT INTO workspaces (owner_user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'My Workspace'))
  ON CONFLICT (owner_user_id) DO NOTHING;
  
  -- Create owner seat (if it doesn't exist)
  INSERT INTO workspace_seats (workspace_id, user_id, tier, status, is_owner)
  SELECT id, NEW.id, 'basic', 'active', TRUE
  FROM workspaces
  WHERE owner_user_id = NEW.id
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists (it should already exist from the workspace migration)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_workspace_for_user();



