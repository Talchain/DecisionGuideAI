/*
  # Fix Team Member Management Function
  
  1. Changes
    - Drop existing function with all parameter combinations
    - Create new function with explicit parameter names
    - Add decision_role parameter for team members
    - Fix ambiguous column references
  
  2. Security
    - Function uses SECURITY DEFINER
    - Proper input validation
    - Explicit error handling
*/

-- Drop all versions of the function to avoid conflicts
DROP FUNCTION IF EXISTS manage_team_member(uuid, text, text);
DROP FUNCTION IF EXISTS manage_team_member(uuid, text, text, text);
DROP FUNCTION IF EXISTS manage_team_member(uuid, text, text, text, text);

-- Recreate the function with explicit table references and parameter names
CREATE OR REPLACE FUNCTION manage_team_member(
  team_uuid UUID,
  email_address TEXT,
  member_role TEXT DEFAULT 'member',
  member_decision_role TEXT DEFAULT 'contributor'
)
RETURNS TABLE (
  id UUID,
  team_id UUID,
  user_id UUID,
  role TEXT,
  decision_role TEXT,
  joined_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Validate input parameters
  IF team_uuid IS NULL THEN
    RAISE EXCEPTION 'team_uuid cannot be null';
  END IF;
  
  IF email_address IS NULL THEN
    RAISE EXCEPTION 'email_address cannot be null';
  END IF;

  IF member_role IS NULL THEN
    member_role := 'member';
  END IF;

  IF member_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid member_role. Must be either admin or member';
  END IF;

  IF member_decision_role IS NULL THEN
    member_decision_role := 'contributor';
  END IF;

  IF member_decision_role NOT IN ('owner', 'approver', 'contributor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid decision_role. Must be one of: owner, approver, contributor, viewer';
  END IF;

  -- Get user_id from auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = email_address;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', email_address;
  END IF;

  -- Check if team_members table has decision_role column
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'team_members' 
    AND column_name = 'decision_role'
  ) THEN
    -- Add decision_role column if it doesn't exist
    ALTER TABLE team_members ADD COLUMN decision_role TEXT;
    
    -- Add index for the new column
    CREATE INDEX IF NOT EXISTS idx_team_members_decision_role ON team_members(decision_role);
  END IF;

  -- Insert or update team member
  RETURN QUERY
  INSERT INTO team_members (team_id, user_id, role, decision_role)
  VALUES (team_uuid, target_user_id, member_role, member_decision_role)
  ON CONFLICT (team_id, user_id) 
  DO UPDATE SET 
    role = EXCLUDED.role,
    decision_role = EXCLUDED.decision_role
  RETURNING 
    team_members.id,
    team_members.team_id,
    team_members.user_id,
    team_members.role,
    team_members.decision_role,
    team_members.joined_at;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION manage_team_member(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION manage_team_member(UUID, TEXT, TEXT, TEXT) IS 
'Manages team members with explicit role and decision role assignments.
Handles adding, updating team members with proper validation.';