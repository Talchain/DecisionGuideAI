/*
  # Fix ambiguous decision_role column reference

  1. Changes
    - Drop and recreate manage_team_member function with explicit table references
    - Add explicit table aliases to avoid column ambiguity
    - Improve error handling and validation

  2. Security
    - Maintains existing RLS policies
    - Preserves security context
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS manage_team_member;

-- Recreate the function with explicit table references
CREATE OR REPLACE FUNCTION manage_team_member(
  team_uuid UUID,
  email_address TEXT,
  member_role TEXT,
  member_decision_role TEXT
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
    RAISE EXCEPTION 'member_role cannot be null';
  END IF;

  IF member_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid member_role. Must be either admin or member';
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