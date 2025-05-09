/*
  # Enhance error handling for registrations

  1. Changes
    - Add more specific error messages based on registration status
    - Improve duplicate email handling
    - Add validation for email format
  
  2. Security
    - Maintain existing RLS policies
    - Add input validation
*/

-- Create or replace the duplicate check function with enhanced error messages
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

-- Drop and recreate the trigger to ensure latest version
DROP TRIGGER IF EXISTS check_duplicate_registration ON public.interest_registrations;
CREATE TRIGGER check_duplicate_registration
  BEFORE INSERT ON public.interest_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_duplicate_registration();

-- Add index for faster duplicate checks
DROP INDEX IF EXISTS idx_interest_registrations_email_status;
CREATE INDEX idx_interest_registrations_email_status 
  ON public.interest_registrations(email, status);

-- Add constraint for email format
ALTER TABLE public.interest_registrations 
  DROP CONSTRAINT IF EXISTS interest_registrations_email_format;
ALTER TABLE public.interest_registrations
  ADD CONSTRAINT interest_registrations_email_format 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add comment explaining error codes
COMMENT ON FUNCTION public.handle_duplicate_registration() IS 
  'Handles duplicate registration attempts with specific error messages:
   - 23505: Duplicate email (with status in DETAIL)
   - 23514: Invalid email format';