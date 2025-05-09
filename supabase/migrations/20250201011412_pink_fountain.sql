/*
  # Update RLS policies for interest registrations

  1. Changes
    - Drop existing policies
    - Create new policies with proper permissions
    - Add better error handling for duplicate emails
  
  2. Security
    - Allow anonymous users to insert registrations
    - Allow authenticated users to view registrations
    - Prevent unauthorized modifications
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view registrations" ON public.interest_registrations;
DROP POLICY IF EXISTS "Allow public to create registrations" ON public.interest_registrations;

-- Create new policies with proper permissions
CREATE POLICY "Enable read access for authenticated users"
  ON public.interest_registrations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for anyone"
  ON public.interest_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL AND
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

CREATE POLICY "Enable update for authenticated users only"
  ON public.interest_registrations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT INSERT ON public.interest_registrations TO anon;
GRANT INSERT ON public.interest_registrations TO authenticated;
GRANT SELECT ON public.interest_registrations TO authenticated;
GRANT UPDATE ON public.interest_registrations TO authenticated;

-- Create function to handle duplicate emails
CREATE OR REPLACE FUNCTION public.handle_duplicate_registration()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.interest_registrations 
    WHERE email = NEW.email
  ) THEN
    RAISE EXCEPTION 'Email already registered'
      USING HINT = 'Please use a different email address',
            ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for duplicate check
DROP TRIGGER IF EXISTS check_duplicate_registration ON public.interest_registrations;
CREATE TRIGGER check_duplicate_registration
  BEFORE INSERT ON public.interest_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_duplicate_registration();