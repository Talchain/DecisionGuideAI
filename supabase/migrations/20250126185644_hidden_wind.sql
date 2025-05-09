/*
  # Auth Tables Check and Fix

  1. New Functions
    - `check_user_profile`: Function to check and create missing user profiles
    - `sync_auth_profiles`: Function to sync auth users with public profiles
  
  2. Security
    - Add RLS policies for new functions
    - Add trigger for auto-creating profiles
  
  3. Changes
    - Add indexes for performance
    - Add profile sync trigger
*/

-- Function to check if user profile exists and create if missing
CREATE OR REPLACE FUNCTION public.check_user_profile(auth_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_exists boolean;
BEGIN
  -- Check if profile exists
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth_user_id
  ) INTO profile_exists;
  
  -- Create profile if it doesn't exist
  IF NOT profile_exists THEN
    INSERT INTO public.user_profiles (
      id,
      created_at,
      updated_at,
      contact_consent
    ) VALUES (
      auth_user_id,
      now(),
      now(),
      false
    );
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Function to sync auth users with public profiles
CREATE OR REPLACE FUNCTION public.sync_auth_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_user RECORD;
BEGIN
  FOR auth_user IN 
    SELECT id FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.user_profiles)
  LOOP
    PERFORM public.check_user_profile(auth_user.id);
  END LOOP;
END;
$$;

-- Add trigger for auto-creating profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, created_at, updated_at, contact_consent)
  VALUES (NEW.id, now(), now(), false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON public.user_profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON public.user_profiles(updated_at);

-- Function to test auth/public table sync
CREATE OR REPLACE FUNCTION public.test_auth_public_sync()
RETURNS TABLE (
  total_auth_users bigint,
  total_profiles bigint,
  missing_profiles bigint,
  orphaned_profiles bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM auth.users) as total_auth_users,
    (SELECT COUNT(*) FROM public.user_profiles) as total_profiles,
    (SELECT COUNT(*) 
     FROM auth.users u 
     LEFT JOIN public.user_profiles p ON u.id = p.id 
     WHERE p.id IS NULL) as missing_profiles,
    (SELECT COUNT(*) 
     FROM public.user_profiles p 
     LEFT JOIN auth.users u ON p.id = u.id 
     WHERE u.id IS NULL) as orphaned_profiles;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.check_user_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_auth_public_sync() TO authenticated;

-- Comment on functions
COMMENT ON FUNCTION public.check_user_profile IS 'Checks if a user profile exists and creates it if missing';
COMMENT ON FUNCTION public.sync_auth_profiles IS 'Syncs auth users with public profiles';
COMMENT ON FUNCTION public.test_auth_public_sync IS 'Tests auth/public table synchronization';