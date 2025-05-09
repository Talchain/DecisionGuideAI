/*
  # Fix Collaborator Functions
  
  1. Changes
    - Drop existing check_user_email_exists function with incorrect return type
    - Create new version with correct return type
    - Maintain get_decision_collaborators function
  
  2. Security
    - Functions use SECURITY DEFINER to safely perform operations
    - Proper permission checks
*/

-- Create or replace the function to get decision collaborators
CREATE OR REPLACE FUNCTION public.get_decision_collaborators(decision_id_param uuid)
RETURNS SETOF public.decision_collaborators
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the requesting user has permission to view these collaborators
  IF NOT EXISTS (
    -- Either the user owns the decision
    SELECT 1 FROM decisions 
    WHERE id = decision_id_param
    AND user_id = auth.uid()
    
    UNION
    
    -- Or the user is an active collaborator on the decision
    SELECT 1 FROM decision_collaborators
    WHERE decision_id = decision_id_param
    AND user_id = auth.uid()
    AND status = 'active'
  ) THEN
    -- Return empty set if not authorized
    RETURN QUERY SELECT * FROM decision_collaborators WHERE 1=0;
    RETURN;
  END IF;
  
  -- Return all collaborators for the decision
  RETURN QUERY 
    SELECT * FROM decision_collaborators
    WHERE decision_id = decision_id_param;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_decision_collaborators(uuid) TO authenticated;

-- Drop existing function with incorrect return type
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
COMMENT ON FUNCTION public.get_decision_collaborators IS 
'Safely retrieves collaborators for a decision, bypassing RLS to avoid recursion.
Performs permission checks to ensure proper access control.';

COMMENT ON FUNCTION public.check_user_email_exists IS 
'Safely check if a user email exists and return their ID without exposing all user emails.';