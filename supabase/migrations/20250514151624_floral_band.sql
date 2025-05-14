/*
  # Add team member function
  
  1. New Functions
    - `add_team_member(p_team_id uuid, p_user_id uuid, p_role text, p_decision_role text)`: 
      Adds a new member to a team with specified roles
      
  2. Security
    - Function is SECURITY DEFINER to run with elevated privileges
    - Checks if caller has admin access to the team
    - Validates role and decision_role values
    
  3. Changes
    - Creates new team member record if one doesn't exist
    - Updates existing record if member already exists
*/

CREATE OR REPLACE FUNCTION add_team_member(
  p_team_id uuid,
  p_user_id uuid,
  p_role text DEFAULT 'member',
  p_decision_role text DEFAULT 'contributor'
)
RETURNS void AS $$
BEGIN
  -- Verify caller has admin access
  IF NOT check_team_admin_access(p_team_id) THEN
    RAISE EXCEPTION 'Access denied: Caller must be team admin';
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role: must be admin or member';
  END IF;

  -- Validate decision_role
  IF p_decision_role NOT IN ('owner', 'approver', 'contributor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid decision_role: must be owner, approver, contributor, or viewer';
  END IF;

  -- Insert or update team member
  INSERT INTO team_members (team_id, user_id, role, decision_role)
  VALUES (p_team_id, p_user_id, p_role, p_decision_role)
  ON CONFLICT (team_id, user_id) 
  DO UPDATE SET 
    role = EXCLUDED.role,
    decision_role = EXCLUDED.decision_role;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;