/*
  # Fix check_user_email_exists Function
  
  1. Changes
    - Drop existing check_user_email_exists function
    - Recreate the function with correct return type and implementation
    - Maintain proper security context
  
  2. Security
    - Function uses SECURITY DEFINER to safely perform operations
    - Proper permission checks
*/

-- Drop existing function with incorrect implementation
DROP FUNCTION IF EXISTS public.check_user_email_exists(text);

-- Create function to check if user email exists with correct return type
CREATE OR REPLACE FUNCTION public.check_user_email_exists(email_to_check text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid;
BEGIN
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = email_to_check
  LIMIT 1;
  
  RETURN json_build_object(
    'exists', user_id IS NOT NULL,
    'id', user_id
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_user_email_exists(text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.check_user_email_exists IS 
'Safely check if a user email exists and return their ID without exposing all user emails.';