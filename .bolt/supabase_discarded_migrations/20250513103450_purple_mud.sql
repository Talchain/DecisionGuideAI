/*
  # Team Members Schema and Policies

  1. Tables
    - `team_members`: Stores team membership information
      - `id` (uuid, primary key)
      - `team_id` (uuid, references teams)
      - `user_id` (uuid, references auth.users)
      - `role` (text, enum: admin/member)
      - `joined_at` (timestamptz)

  2. Functions
    - `check_team_admin_access`: Check if user is team admin
    - `check_team_member_access`: Check if user is team member
    - `handle_team_creator_admin`: Add team creator as admin on team creation

  3. Policies
    - View: Team members and admins can view
    - Add/Update/Delete: Only team admins can modify
*/

-- Drop existing functions with unique names
DROP FUNCTION IF EXISTS check_team_admin_access(uuid);
DROP FUNCTION IF EXISTS check_team_member_access(uuid);
DROP FUNCTION IF EXISTS handle_team_creator_admin();

-- Create team_members table
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

-- Helper function to check if user is team admin (renamed for uniqueness)
CREATE OR REPLACE FUNCTION check_team_admin_access(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = team_uuid
    AND team_members.user_id = auth.uid()
    AND team_members.role = 'admin'
  );
$$;

-- Helper function to check if user is team member (renamed for uniqueness)
CREATE OR REPLACE FUNCTION check_team_member_access(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = team_uuid
    AND team_members.user_id = auth.uid()
  );
$$;

-- Policies for team_members table

-- View members: Team admins and members can view
CREATE POLICY "View team members"
  ON team_members
  FOR SELECT
  USING (
    check_team_member_access(team_id) OR
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_id
      AND teams.created_by = auth.uid()
    )
  );

-- Add members: Only team admins can add
CREATE POLICY "Add team members"
  ON team_members
  FOR INSERT
  WITH CHECK (
    check_team_admin_access(team_id) OR
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_id
      AND teams.created_by = auth.uid()
    )
  );

-- Update members: Only team admins can update
CREATE POLICY "Update team members"
  ON team_members
  FOR UPDATE
  USING (
    check_team_admin_access(team_id) OR
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_id
      AND teams.created_by = auth.uid()
    )
  );

-- Remove members: Only team admins can remove
CREATE POLICY "Remove team members"
  ON team_members
  FOR DELETE
  USING (
    check_team_admin_access(team_id) OR
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_id
      AND teams.created_by = auth.uid()
    )
  );

-- Add team creator as admin member on team creation (renamed for uniqueness)
CREATE OR REPLACE FUNCTION handle_team_creator_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER add_team_creator_as_admin
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION handle_team_creator_admin();