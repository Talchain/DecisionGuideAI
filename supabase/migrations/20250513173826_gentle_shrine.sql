/*
  # Team Members Management
  
  1. New Functions
    - check_team_admin(team_uuid): Checks if user is team admin
    - check_team_member(team_uuid): Checks if user is team member
    - get_team_members(team_uuid): Gets all members for a team
  
  2. Tables
    - team_members: Stores team membership and roles
    
  3. Security
    - Enable RLS on team_members
    - Policies for team creators and admins
    - Self-view policy for members
*/

-- Drop existing policies if they exist
DO $$ BEGIN
  -- Team members policies
  DROP POLICY IF EXISTS "Team creators can manage members" ON team_members;
  DROP POLICY IF EXISTS "Team admins can manage members" ON team_members;
  DROP POLICY IF EXISTS "Members can view own membership" ON team_members;
  
  -- Helper functions
  DROP FUNCTION IF EXISTS check_team_admin;
  DROP FUNCTION IF EXISTS check_team_member;
  DROP FUNCTION IF EXISTS get_team_members;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN undefined_function THEN
    NULL;
END $$;

-- Create team_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is team admin
CREATE OR REPLACE FUNCTION check_team_admin(team_uuid uuid)
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

-- Helper function to check if user is team member
CREATE OR REPLACE FUNCTION check_team_member(team_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = team_uuid 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team members with user details
CREATE OR REPLACE FUNCTION get_team_members(team_uuid uuid)
RETURNS TABLE (
  id uuid,
  team_id uuid,
  user_id uuid,
  role text,
  joined_at timestamptz,
  email text
) AS $$
BEGIN
  IF NOT check_team_member(team_uuid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT 
    tm.id,
    tm.team_id,
    tm.user_id,
    tm.role,
    tm.joined_at,
    u.email
  FROM team_members tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE tm.team_id = team_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies

-- Team creators and admins can view all members
CREATE POLICY "Team creators and admins can view members"
  ON team_members
  FOR SELECT
  TO authenticated
  USING (check_team_admin(team_id));

-- Members can view their own membership
CREATE POLICY "Members can view own membership"
  ON team_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only team creators and admins can insert members
CREATE POLICY "Team creators and admins can add members"
  ON team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (check_team_admin(team_id));

-- Only team creators and admins can update members
CREATE POLICY "Team creators and admins can update members"
  ON team_members
  FOR UPDATE
  TO authenticated
  USING (check_team_admin(team_id))
  WITH CHECK (check_team_admin(team_id));

-- Only team creators and admins can delete members
CREATE POLICY "Team creators and admins can delete members"
  ON team_members
  FOR DELETE
  TO authenticated
  USING (check_team_admin(team_id));