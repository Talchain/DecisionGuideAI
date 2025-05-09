-- Drop existing policies
DROP POLICY IF EXISTS "Allow anonymous registration" ON public.interest_registrations;
DROP POLICY IF EXISTS "Allow authenticated registration" ON public.interest_registrations;
DROP POLICY IF EXISTS "Allow authenticated users to view registrations" ON public.interest_registrations;

-- Create new policies with proper security
CREATE POLICY "Enable public registration check"
  ON public.interest_registrations
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Enable public registration"
  ON public.interest_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL AND
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

-- Ensure RLS is enabled
ALTER TABLE public.interest_registrations ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON public.interest_registrations TO anon;
GRANT SELECT, INSERT ON public.interest_registrations TO authenticated;

-- Ensure sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create or replace the registration check function with better error handling
CREATE OR REPLACE FUNCTION public.check_registration_exists(email_to_check text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registration_record record;
BEGIN
  -- Input validation
  IF email_to_check IS NULL OR email_to_check = '' THEN
    RETURN json_build_object(
      'exists', false,
      'error', 'Email is required'
    );
  END IF;

  -- Check registration
  SELECT * INTO registration_record
  FROM public.interest_registrations
  WHERE email = email_to_check;

  IF registration_record IS NULL THEN
    RETURN json_build_object(
      'exists', false,
      'status', null
    );
  END IF;

  RETURN json_build_object(
    'exists', true,
    'status', registration_record.status,
    'created_at', registration_record.created_at
  );
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.check_registration_exists(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_registration_exists(text) TO authenticated;

-- Add comment explaining function usage
COMMENT ON FUNCTION public.check_registration_exists IS 
  'Safely checks if an email registration exists and returns its status and creation date';