-- Make user creation trigger more robust
-- This ensures user creation doesn't fail even if profile/workspace creation has issues

CREATE OR REPLACE FUNCTION create_workspace_for_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile (if it doesn't exist)
  -- Use minimal required fields to avoid constraint issues
  BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;

  -- Create default free subscription (if it doesn't exist)
  BEGIN
    INSERT INTO public.subscriptions (user_id, tier, status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to create subscription for user %: %', NEW.id, SQLERRM;
  END;

  -- Create workspace (if it doesn't exist)
  BEGIN
    INSERT INTO workspaces (owner_user_id, name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'My Workspace'))
    ON CONFLICT (owner_user_id) DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to create workspace for user %: %', NEW.id, SQLERRM;
  END;
  
  -- Create owner seat (if it doesn't exist)
  BEGIN
    INSERT INTO workspace_seats (workspace_id, user_id, tier, status, is_owner)
    SELECT id, NEW.id, 'basic', 'active', TRUE
    FROM workspaces
    WHERE owner_user_id = NEW.id
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to create seat for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


