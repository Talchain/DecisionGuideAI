/*
  # Add team members management
  
  1. New Tables
    - `team_members`
      - `id` (uuid, primary key)
      - `team_id` (uuid, references teams)
      - `user_id` (uuid, references auth.users)
      - `role` (text, check constraint for valid roles)
      - `joined_at` (timestamp with time zone)
  
  2. Security
    - Enable RLS on team_members table
    - Add policies for team creators and members
    - Add helper functions for permission checks
*/

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

-- Helper function to check if user is team admin
CREATE OR REPLACE FUNCTION is_team_admin(team_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = $1
    AND team_members.user_id = auth.uid()
    AND team_members.role = 'admin'
  );
$$;

-- Helper function to check if user is team member
CREATE OR REPLACE FUNCTION is_team_member(team_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = $1
    AND team_members.user_id = auth.uid()
  );
$$;

-- Policies for team_members table

-- View members: Team admins and members can view
CREATE POLICY "View team members"
  ON team_members
  FOR SELECT
  USING (
    is_team_member(team_id) OR
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
    is_team_admin(team_id) OR
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
    is_team_admin(team_id) OR
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
    is_team_admin(team_id) OR
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_id
      AND teams.created_by = auth.uid()
    )
  );

-- Add team creator as admin member on team creation
CREATE OR REPLACE FUNCTION add_team_creator_as_admin()
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
  EXECUTE FUNCTION add_team_creator_as_admin();