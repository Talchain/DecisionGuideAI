/*
  # Add get_team_invitations function
  
  1. New Functions
    - `get_team_invitations`: Retrieves pending invitations for a team
      - Input: team_uuid (uuid)
      - Returns: Table of invitations with their details
  
  2. Security
    - Function is accessible to authenticated users only
    - Checks if user has permission to view team invitations
*/

-- Drop existing function if it exists (safe operation as it's new)
DROP FUNCTION IF EXISTS public.get_team_invitations(team_uuid uuid);

-- Create the function to get team invitations
CREATE OR REPLACE FUNCTION public.get_team_invitations(team_uuid uuid)
RETURNS TABLE (
  id uuid,
  email text,
  invited_at timestamptz,
  status text,
  role text,
  decision_role text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user has permission to view team invitations
  IF NOT EXISTS (
    SELECT 1 FROM teams 
    WHERE id = team_uuid 
    AND (
      created_by = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_id = team_uuid 
        AND user_id = auth.uid() 
        AND role = 'admin'
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to view team invitations';
  END IF;

  -- Return pending invitations for the team
  RETURN QUERY
  SELECT 
    i.id,
    i.email,
    i.invited_at,
    i.status,
    tm.role,
    tm.decision_role
  FROM invitations i
  JOIN team_members tm ON tm.id = i.id
  WHERE tm.team_id = team_uuid
  AND i.status = 'pending'
  ORDER BY i.invited_at DESC;
END;
$$;