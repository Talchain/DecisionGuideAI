-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- Create more permissive policies
CREATE POLICY "Enable read access for authenticated users"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for authenticated users"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update access for users based on id"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure RLS is enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;

-- Create or replace the function to handle new users with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.user_profiles (
      id,
      created_at,
      updated_at,
      contact_consent
    ) VALUES (
      NEW.id,
      now(),
      now(),
      false
    );
  EXCEPTION 
    WHEN unique_violation THEN
      -- Profile already exists, ignore
      RETURN NEW;
    WHEN OTHERS THEN
      -- Log other errors but don't fail
      RAISE WARNING 'Error creating user profile: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to sync missing profiles with error handling
CREATE OR REPLACE FUNCTION public.sync_missing_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT id 
    FROM auth.users 
    WHERE id NOT IN (SELECT id FROM public.user_profiles)
  LOOP
    BEGIN
      INSERT INTO public.user_profiles (
        id,
        created_at,
        updated_at,
        contact_consent
      ) VALUES (
        user_record.id,
        now(),
        now(),
        false
      );
    EXCEPTION 
      WHEN unique_violation THEN
        -- Profile already exists, continue to next
        CONTINUE;
      WHEN OTHERS THEN
        -- Log other errors but continue processing
        RAISE WARNING 'Error syncing profile for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Run sync for existing users
SELECT public.sync_missing_profiles();