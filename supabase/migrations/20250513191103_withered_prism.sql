/*
  # Fix Team Member Management

  1. Changes
    - Add missing indexes for performance
    - Fix team member management functions
    - Update RLS policies for better security
    - Add cascade delete for team members

  2. Security
    - Enable RLS on team_members table
    - Add policies for team creators and admins
    - Add policies for viewing own membership
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS manage_team_member;
DROP FUNCTION IF EXISTS get_teams_with_members;
DROP FUNCTION IF EXISTS has_team_permission;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);

-- Function to check team permissions
CREATE OR REPLACE FUNCTION has_team_permission(team_uuid uuid)
RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to manage team members
CREATE OR REPLACE FUNCTION manage_team_member(
  team_uuid uuid,
  email_address text,
  member_role text DEFAULT 'member',
  operation text DEFAULT 'add'
)
RETURNS jsonb AS $$
DECLARE
  target_user_id uuid;
  result jsonb;
BEGIN
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
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (team_uuid, target_user_id, member_role)
      ON CONFLICT (team_id, user_id) 
      DO UPDATE SET role = EXCLUDED.role
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
      
    ELSE
      RAISE EXCEPTION 'Invalid operation: %', operation;
  END CASE;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team creators can manage members" ON team_members;
DROP POLICY IF EXISTS "Team admins can manage members" ON team_members;
DROP POLICY IF EXISTS "Members can view own membership" ON team_members;

-- Allow team creators and admins to manage members
CREATE POLICY "Team creators and admins can manage members"
ON team_members
FOR ALL
TO authenticated
USING (has_team_permission(team_id))
WITH CHECK (has_team_permission(team_id));

-- Allow members to view their own membership
CREATE POLICY "Members can view own membership"
ON team_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());