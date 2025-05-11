-- Create helper function to check if a user has access to collaborator data
CREATE OR REPLACE FUNCTION public.has_collaborator_access(
  decision_id_param uuid,
  user_id_param uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    -- Check if user owns the decision
    SELECT 1 FROM decisions
    WHERE id = decision_id_param
    AND user_id = user_id_param
    
    UNION
    
    -- Check if user is an active collaborator
    SELECT 1 FROM decision_collaborators
    WHERE decision_id = decision_id_param
    AND user_id = user_id_param
    AND status = 'active'
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.has_collaborator_access TO authenticated;

COMMENT ON FUNCTION public.has_collaborator_access IS
'Checks if a user has access to view collaborator data for a decision
without causing recursive RLS policy evaluation.';