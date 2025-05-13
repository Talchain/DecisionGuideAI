/*
  # Fix manage_team_member Function
  
  1. Changes
    - Drop existing function with all parameter combinations
    - Create new function with correct parameter order and implementation
    - Add proper validation for all parameters
    - Add proper error handling
  
  2. Security
    - Function uses SECURITY DEFINER to safely perform operations
    - Proper permission checks
    - Input validation
*/

-- Drop all versions of the function to avoid conflicts
DROP FUNCTION IF EXISTS public.manage_team_member(uuid, text, text);
DROP FUNCTION IF EXISTS public.manage_team_member(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.manage_team_member(uuid, text, text, text, text);

-- Create function to check if user has permission to manage team
CREATE OR REPLACE FUNCTION public.check_team_admin(team_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM teams
    WHERE id = team_uuid 
    AND created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = team_uuid 
    AND user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- Recreate the function with correct parameter order and implementation
CREATE OR REPLACE FUNCTION public.manage_team_member(
  team_uuid uuid,
  email_address text,
  member_role text DEFAULT 'member',
  member_decision_role text DEFAULT 'contributor'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  result jsonb;
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

  -- Check if user has permission to manage team
  IF NOT check_team_admin(team_uuid) THEN
    RAISE EXCEPTION 'Not authorized to manage team members';
  END IF;

  -- Get user_id from auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = email_address;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', email_address;
  END IF;

  -- Insert or update team member
  INSERT INTO public.team_members (team_id, user_id, role, decision_role)
  VALUES (team_uuid, target_user_id, member_role, member_decision_role)
  ON CONFLICT (team_id, user_id) 
  DO UPDATE SET 
    role = EXCLUDED.role,
    decision_role = EXCLUDED.decision_role
  RETURNING jsonb_build_object(
    'id', id,
    'team_id', team_id,
    'user_id', user_id,
    'role', role,
    'decision_role', decision_role,
    'joined_at', joined_at
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.manage_team_member(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_team_admin(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.manage_team_member(uuid, text, text, text) IS 
'Manages team members with explicit role and decision role assignments.
Handles adding and updating team members with proper validation.';