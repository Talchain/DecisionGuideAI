-- Create function to safely check registration existence
CREATE OR REPLACE FUNCTION public.check_registration_exists(email_to_check text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registration_status text;
BEGIN
  SELECT status INTO registration_status
  FROM public.interest_registrations
  WHERE email = email_to_check;

  RETURN json_build_object(
    'exists', registration_status IS NOT NULL,
    'status', registration_status
  );
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.check_registration_exists(text) TO anon;

-- Add comment explaining function usage
COMMENT ON FUNCTION public.check_registration_exists IS 
  'Safely checks if an email registration exists and returns its status';