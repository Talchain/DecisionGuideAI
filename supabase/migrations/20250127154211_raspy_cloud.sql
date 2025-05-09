-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable update access for users based on id" ON public.user_profiles;

-- Create new policies with proper session handling
CREATE POLICY "Allow users to read their own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Allow users to insert their own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Allow users to update their own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Ensure RLS is enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create function to initialize profile on user creation
CREATE OR REPLACE FUNCTION public.initialize_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create new trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_profile();

-- Function to sync existing users
CREATE OR REPLACE FUNCTION public.sync_user_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    created_at,
    updated_at,
    contact_consent
  )
  SELECT 
    id,
    now(),
    now(),
    false
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.user_profiles)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Run sync for existing users
SELECT public.sync_user_profiles();