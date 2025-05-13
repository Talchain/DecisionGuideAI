/*
  # Fix teams selection and add team management functions
  
  1. Changes
    - Add function to safely get team details with members
    - Add function to check team permissions
    - Add function to manage team invitations
    
  2. Security
    - All functions use SECURITY DEFINER
    - Proper permission checks
    - Safe member data access
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_team_details;
DROP FUNCTION IF EXISTS check_team_permission;
DROP FUNCTION IF EXISTS manage_team_invitation;

-- Function to get team details with members
CREATE OR REPLACE FUNCTION get_team_details(team_uuid uuid)
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
DECLARE
  requesting_user_id uuid;
BEGIN
  requesting_user_id := auth.uid();
  
  -- Check if user has access to team
  IF NOT (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_uuid 
      AND (t.created_by = requesting_user_id 
        OR EXISTS (
          SELECT 1 FROM team_members tm 
          WHERE tm.team_id = t.id 
          AND tm.user_id = requesting_user_id
        )
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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
  WHERE t.id = team_uuid;
END;
$$;

-- Function to check team permissions
CREATE OR REPLACE FUNCTION check_team_permission(
  team_uuid uuid,
  required_role text DEFAULT NULL
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role text;
BEGIN
  -- Check if user is team creator
  IF EXISTS (
    SELECT 1 FROM teams
    WHERE id = team_uuid 
    AND created_by = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  -- Get user's role in team
  SELECT role INTO user_role
  FROM team_members
  WHERE team_id = team_uuid
  AND user_id = auth.uid();

  -- If no specific role required, any membership is enough
  IF required_role IS NULL THEN
    RETURN user_role IS NOT NULL;
  END IF;

  -- Check if user has required role
  RETURN user_role = required_role;
END;
$$;

-- Function to manage team invitations
CREATE OR REPLACE FUNCTION manage_team_invitation(
  team_uuid uuid,
  email_address text,
  member_role text DEFAULT 'member'
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
  -- Check if caller has permission
  IF NOT check_team_permission(team_uuid, 'admin') THEN
    RAISE EXCEPTION 'Not authorized to manage team members';
  END IF;

  -- Get user ID from email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = email_address;

  -- Create invitation
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (team_uuid, target_user_id, member_role)
  RETURNING jsonb_build_object(
    'id', id,
    'team_id', team_id,
    'user_id', user_id,
    'role', role,
    'joined_at', joined_at
  ) INTO result;

  RETURN result;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'User is already a team member';
  WHEN not_null_violation THEN
    RAISE EXCEPTION 'User not found with email %', email_address;
END;
$$;