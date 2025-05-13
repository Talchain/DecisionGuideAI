/*
  # Add Decision Roles to Team Members
  
  1. Changes
    - Add decision_role column to team_members table
    - Update role constraint to include new roles
    - Add helper functions for role validation
  
  2. Security
    - Maintain existing RLS policies
    - Add validation for new roles
*/

-- Add decision_role column with role validation
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS decision_role text 
  CHECK (decision_role IN ('owner', 'approver', 'contributor', 'viewer'));

-- Update existing role constraint to be more specific
ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_role_check;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check 
  CHECK (role IN ('admin', 'member'));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_team_members_decision_role 
  ON public.team_members(decision_role);

-- Update manage_team_member function to handle decision roles
CREATE OR REPLACE FUNCTION manage_team_member(
  team_uuid uuid,
  email_address text,
  member_role text DEFAULT 'member',
  decision_role text DEFAULT 'viewer',
  operation text DEFAULT 'add'
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_id uuid;
  result jsonb;
BEGIN
  -- Validate roles
  IF member_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid member role: %', member_role;
  END IF;

  IF decision_role NOT IN ('owner', 'approver', 'contributor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid decision role: %', decision_role;
  END IF;

  -- Check permission
  IF NOT has_team_permission(team_uuid) THEN
    RAISE EXCEPTION 'Not authorized to manage team members';
  END IF;

  -- Get user ID from email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = email_address;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found with email %', email_address;
  END IF;

  -- Perform operation
  CASE operation
    WHEN 'add' THEN
      INSERT INTO team_members (team_id, user_id, role, decision_role)
      VALUES (team_uuid, target_user_id, member_role, decision_role)
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
      
    WHEN 'update' THEN
      UPDATE team_members
      SET 
        role = member_role,
        decision_role = decision_role
      WHERE team_id = team_uuid AND user_id = target_user_id
      RETURNING jsonb_build_object(
        'id', id,
        'team_id', team_id,
        'user_id', user_id,
        'role', role,
        'decision_role', decision_role,
        'joined_at', joined_at
      ) INTO result;
      
    WHEN 'remove' THEN
      DELETE FROM team_members
      WHERE team_id = team_uuid AND user_id = target_user_id
      RETURNING jsonb_build_object(
        'id', id,
        'team_id', team_id,
        'user_id', user_id,
        'role', role,
        'decision_role', decision_role,
        'joined_at', joined_at
      ) INTO result;
      
    ELSE
      RAISE EXCEPTION 'Invalid operation: %', operation;
  END CASE;

  RETURN result;
END;
$$;

-- Update get_teams_with_members function to include decision_role
CREATE OR REPLACE FUNCTION get_teams_with_members(user_uuid uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  members jsonb
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.created_by,
    t.created_at,
    t.updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', tm.id,
            'team_id', tm.team_id,
            'user_id', tm.user_id,
            'role', tm.role,
            'decision_role', tm.decision_role,
            'joined_at', tm.joined_at,
            'email', u.email
          )
        )
        FROM team_members tm
        JOIN auth.users u ON u.id = tm.user_id
        WHERE tm.team_id = t.id
      ),
      '[]'::jsonb
    ) as members
  FROM teams t
  WHERE t.created_by = user_uuid
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = t.id
    AND tm.user_id = user_uuid
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION manage_team_member(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_teams_with_members(uuid) TO authenticated;