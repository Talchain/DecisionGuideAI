-- Re-add the users relationship to solve the collaborators query issue
ALTER TABLE public.decision_collaborators
  DROP CONSTRAINT IF EXISTS decision_collaborators_user_id_fkey;
  
-- Add the constraint back with the correct reference
ALTER TABLE public.decision_collaborators
  ADD CONSTRAINT decision_collaborators_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id);
  
-- Create a convenience RPC function to check if email exists
CREATE OR REPLACE FUNCTION public.check_user_email_exists(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = email_to_check
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_user_email_exists TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.check_user_email_exists IS 
'Safely check if a user email exists without exposing all user emails.';