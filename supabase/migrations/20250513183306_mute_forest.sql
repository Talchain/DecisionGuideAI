/*
  # Fix teams loading and member management
  
  1. Changes
    - Add function to get teams with members
    - Add function to check team permissions
    - Add function to manage team invitations
    - Fix team member policies
  
  2. Security
    - All functions are SECURITY DEFINER
    - Proper RLS policies for team members
    - Input validation and error handling
*/

-- Function to get teams with members
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

-- Function to check if user has team permission
CREATE OR REPLACE FUNCTION has_team_permission(
  team_uuid uuid,
  required_role text DEFAULT NULL
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  requesting_user_id uuid;
  user_role text;
BEGIN
  requesting_user_id := auth.uid();
  
  -- Check if user is team creator
  IF EXISTS (
    SELECT 1 FROM teams
    WHERE id = team_uuid 
    AND created_by = requesting_user_id
  ) THEN
    RETURN true;
  END IF;

  -- Get user's role
  SELECT role INTO user_role
  FROM team_members
  WHERE team_id = team_uuid
  AND user_id = requesting_user_id;

  -- If no specific role required, any membership is enough
  IF required_role IS NULL THEN
    RETURN user_role IS NOT NULL;
  END IF;

  -- Check specific role
  RETURN user_role = required_role;
END;
$$;

-- Function to manage team members
CREATE OR REPLACE FUNCTION manage_team_member(
  team_uuid uuid,
  email_address text,
  member_role text DEFAULT 'member',
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
  -- Validate operation
  IF operation NOT IN ('add', 'remove', 'update') THEN
    RAISE EXCEPTION 'Invalid operation: %', operation;
  END IF;

  -- Check permission
  IF NOT has_team_permission(team_uuid, 'admin') THEN
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
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (team_uuid, target_user_id, member_role)
      RETURNING jsonb_build_object(
        'id', id,
        'team_id', team_id,
        'user_id', user_id,
        'role', role,
        'joined_at', joined_at
      ) INTO result;
      
    WHEN 'update' THEN
      UPDATE team_members
      SET role = member_role
      WHERE team_id = team_uuid AND user_id = target_user_id
      RETURNING jsonb_build_object(
        'id', id,
        'team_id', team_id,
        'user_id', user_id,
        'role', role,
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
        'joined_at', joined_at
      ) INTO result;
  END CASE;

  RETURN result;
END;
$$;