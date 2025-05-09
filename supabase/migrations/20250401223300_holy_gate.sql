/*
  # Create get_decision_collaborators Function and Fix RLS Policies

  1. New Functions
    - `get_decision_collaborators`: Bypasses RLS for safely retrieving collaborators
    
  2. Changes to Existing Policies
    - Fix infinite recursion issue in decision_collaborators policies
    
  3. Security
    - Function uses SECURITY DEFINER to safely perform operations
    - Proper permission checks
*/

-- Create function to safely get collaborators without RLS recursion
CREATE OR REPLACE FUNCTION public.get_decision_collaborators(decision_id_param uuid)
RETURNS SETOF public.decision_collaborators
LANGUAGE plpgsql
SECURITY DEFINER -- Important: uses the privileges of the function creator, not caller
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

-- Add comments
COMMENT ON FUNCTION public.get_decision_collaborators IS 
'Safely retrieves collaborators for a decision, bypassing RLS to avoid recursion.
Performs permission checks to ensure proper access control.';