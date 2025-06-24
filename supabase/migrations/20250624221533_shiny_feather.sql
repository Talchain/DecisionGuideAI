/*
  # Update Teams Table with Organization ID

  1. Schema Changes
    - Add `organisation_id` column to `teams` table
    - Add foreign key constraint to `organisations` table
    - Add index for performance

  2. Security Updates
    - Update RLS policies on `teams` table to incorporate organization-level access
    - Ensure teams are only accessible by organization members

  3. Data Migration Preparation
    - Add column as nullable initially to allow for data migration
    - Will be made NOT NULL after migration is complete

  4. Constraints
    - Foreign key constraint to organisations table
    - Index for performance on organisation_id
*/

-- Add organisation_id column to teams table (nullable for now, will be made NOT NULL after migration)
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS teams_organisation_id_idx ON teams(organisation_id);

-- Drop existing RLS policies on teams table to recreate them with organization context
DROP POLICY IF EXISTS "Users can read teams they belong to" ON teams;
DROP POLICY IF EXISTS "Team members can read team details" ON teams;
DROP POLICY IF EXISTS "Team creators can update teams" ON teams;
DROP POLICY IF EXISTS "Team creators can delete teams" ON teams;
DROP POLICY IF EXISTS "Authenticated users can create teams" ON teams;

-- Updated RLS Policies for teams table with organization context
-- Policy: Users can read teams in organizations they belong to
CREATE POLICY "Users can read teams in their organizations"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id 
      FROM organisation_members 
      WHERE user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

-- Policy: Organization members can create teams in their organization
CREATE POLICY "Organization members can create teams"
  ON teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id 
      FROM organisation_members 
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
    AND created_by = auth.uid()
  );

-- Policy: Team creators and organization admins can update teams
CREATE POLICY "Team creators and org admins can update teams"
  ON teams
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR organisation_id IN (
      SELECT organisation_id 
      FROM organisation_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Policy: Team creators and organization admins can delete teams
CREATE POLICY "Team creators and org admins can delete teams"
  ON teams
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR organisation_id IN (
      SELECT organisation_id 
      FROM organisation_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Update team_members RLS policies to consider organization membership
DROP POLICY IF EXISTS "Users can read team memberships" ON team_members;
DROP POLICY IF EXISTS "Team admins can manage team members" ON team_members;

-- Policy: Users can read team memberships in their organizations
CREATE POLICY "Users can read team memberships in their organizations"
  ON team_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT t.id 
      FROM teams t
      JOIN organisation_members om ON t.organisation_id = om.organisation_id
      WHERE om.user_id = auth.uid()
    )
  );

-- Policy: Team admins and organization admins can manage team members
CREATE POLICY "Team and org admins can manage team members"
  ON team_members
  FOR ALL
  TO authenticated
  USING (
    team_id IN (
      SELECT tm.team_id 
      FROM team_members tm 
      WHERE tm.user_id = auth.uid() 
      AND tm.role IN ('admin', 'owner')
    )
    OR team_id IN (
      SELECT t.id 
      FROM teams t
      JOIN organisation_members om ON t.organisation_id = om.organisation_id
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin')
    )
    OR user_id = auth.uid() -- Users can manage their own membership
  );