/*
  # Fix RLS policies for interest registrations

  1. Changes
    - Drop existing policies
    - Create new policies with proper permissions for anonymous users
    - Add better error handling for duplicates
  
  2. Security
    - Allow anonymous users to insert registrations
    - Allow authenticated users to view registrations
    - Prevent unauthorized modifications
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.interest_registrations;
DROP POLICY IF EXISTS "Enable insert for anyone" ON public.interest_registrations;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.interest_registrations;

-- Create new policies with proper permissions
CREATE POLICY "Enable read for authenticated users"
  ON public.interest_registrations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for anonymous users"
  ON public.interest_registrations
  FOR INSERT
  TO anon
  WITH CHECK (
    email IS NOT NULL AND
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

CREATE POLICY "Enable insert for authenticated users"
  ON public.interest_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    email IS NOT NULL AND
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT INSERT ON public.interest_registrations TO anon;
GRANT INSERT ON public.interest_registrations TO authenticated;
GRANT SELECT ON public.interest_registrations TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE public.interest_registrations ENABLE ROW LEVEL SECURITY;

-- Create better error handling for duplicates
CREATE OR REPLACE FUNCTION public.handle_duplicate_registration()
RETURNS trigger AS $$
BEGIN
  -- Check for existing registration
  IF EXISTS (
    SELECT 1 FROM public.interest_registrations 
    WHERE email = NEW.email
  ) THEN
    -- Get status of existing registration
    DECLARE
      existing_status text;
    BEGIN
      SELECT status INTO existing_status
      FROM public.interest_registrations
      WHERE email = NEW.email;

      -- Raise appropriate error based on status
      CASE existing_status
        WHEN 'approved' THEN
          RAISE EXCEPTION 'Email already registered and approved'
            USING HINT = 'Please check your email for access instructions',
                  ERRCODE = '23505';
        WHEN 'pending' THEN
          RAISE EXCEPTION 'Email already registered'
            USING HINT = 'You will be notified when early access is available',
                  ERRCODE = '23505';
        ELSE
          RAISE EXCEPTION 'Email already registered'
            USING HINT = 'Please use a different email address',
                  ERRCODE = '23505';
      END CASE;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;