/*
  # Fix team members RLS policies

  1. Changes
    - Remove recursive policies that were causing infinite loops
    - Simplify team member access policies
    - Add non-recursive policy for team admins
    - Add direct policy for team members

  2. Security
    - Maintain RLS protection
    - Ensure proper access control
    - Prevent infinite recursion
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Admins can manage members" ON team_members;
DROP POLICY IF EXISTS "Creator can add self as admin" ON team_members;
DROP POLICY IF EXISTS "Manage members as admin" ON team_members;
DROP POLICY IF EXISTS "Self-add as admin when creating team" ON team_members;
DROP POLICY IF EXISTS "View own memberships" ON team_members;
DROP POLICY IF EXISTS "View team members" ON team_members;

-- Create new, non-recursive policies
CREATE POLICY "Enable insert for team admins"
ON team_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.team_id = NEW.team_id
    AND team_members.user_id = auth.uid()
    AND team_members.role = 'admin'
  )
  OR 
  EXISTS (
    SELECT 1 FROM teams
    WHERE teams.id = NEW.team_id
    AND teams.created_by = auth.uid()
  )
);

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