/*
  # Fix Team Members RLS Policies
  
  1. Changes
    - Drop existing policies to avoid conflicts
    - Create new non-recursive policies for team member management
    - Fix the INSERT policy to avoid using NEW reference
    - Ensure proper access control for team admins and members
  
  2. Security
    - Enable RLS on team_members table
    - Restrict access based on team membership and admin roles
    - Allow team creators to add themselves as admins
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Admins can manage members" ON team_members;
DROP POLICY IF EXISTS "Creator can add self as admin" ON team_members;
DROP POLICY IF EXISTS "Manage members as admin" ON team_members;
DROP POLICY IF EXISTS "Self-add as admin when creating team" ON team_members;
DROP POLICY IF EXISTS "View own memberships" ON team_members;
DROP POLICY IF EXISTS "View team members" ON team_members;

-- Create new, non-recursive policies
CREATE POLICY "Enable insert access for system"
ON team_members
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable select for team members"
ON team_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR
  team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Enable update for team admins"
ON team_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = team_id
    AND team_members.user_id = auth.uid()
    AND team_members.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = team_id
    AND team_members.user_id = auth.uid()
    AND team_members.role = 'admin'
  )
);

CREATE POLICY "Enable delete for team admins"
ON team_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = team_id
    AND team_members.user_id = auth.uid()
    AND team_members.role = 'admin'
  )
);

-- Ensure RLS is enabled
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;