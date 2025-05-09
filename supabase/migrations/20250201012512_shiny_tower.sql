/*
  # Fix RLS policies for interest registrations

  1. Changes
    - Drop existing policies
    - Create new policies with proper permissions
    - Enable RLS
    - Grant necessary permissions
    - Add better error handling
  
  2. Security
    - Allow anonymous users to insert registrations
    - Allow authenticated users to view registrations
    - Maintain data integrity with constraints
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.interest_registrations;
DROP POLICY IF EXISTS "Enable insert for anonymous users" ON public.interest_registrations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.interest_registrations;

-- Create new policies with proper permissions
CREATE POLICY "Allow anonymous registration"
  ON public.interest_registrations
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated registration"
  ON public.interest_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view registrations"
  ON public.interest_registrations
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure RLS is enabled
ALTER TABLE public.interest_registrations ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT INSERT ON public.interest_registrations TO anon;
GRANT INSERT, SELECT ON public.interest_registrations TO authenticated;

-- Ensure sequence permissions are granted
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add better error handling for duplicates
CREATE OR REPLACE FUNCTION public.handle_duplicate_registration()
RETURNS trigger AS $$
DECLARE
  existing_status text;
BEGIN
  -- Check for existing registration with status
  SELECT status INTO existing_status
  FROM public.interest_registrations 
  WHERE email = NEW.email;
  
  IF existing_status IS NOT NULL THEN
    CASE existing_status
      WHEN 'approved' THEN
        RAISE EXCEPTION 'Email already registered and approved'
          USING 
            HINT = 'Please check your email for access instructions',
            DETAIL = '{"status": "approved"}',
            ERRCODE = '23505';
      WHEN 'pending' THEN
        RAISE EXCEPTION 'Email already registered and pending'
          USING 
            HINT = 'You will be notified when early access is available',
            DETAIL = '{"status": "pending"}',
            ERRCODE = '23505';
      ELSE
        RAISE EXCEPTION 'Email already registered'
          USING 
            HINT = 'Please use a different email address',
            DETAIL = '{"status": "unknown"}',
            ERRCODE = '23505';
    END CASE;
  END IF;

  -- Email format validation
  IF NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format'
      USING 
        HINT = 'Please enter a valid email address',
        ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS check_duplicate_registration ON public.interest_registrations;
CREATE TRIGGER check_duplicate_registration
  BEFORE INSERT ON public.interest_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_duplicate_registration();

-- Add comment explaining error codes
COMMENT ON FUNCTION public.handle_duplicate_registration() IS 
  'Handles duplicate registration attempts with specific error messages:
   - 23505: Duplicate email (with status in DETAIL)
   - 23514: Invalid email format';