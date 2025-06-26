/*
  # Update RLS Policies for Organization Access

  1. New Functions
    - `can_access_organisation_resource` - Checks if a user can access an organization resource

  2. Updated Policies
    - Updated policies for decisions, criteria_sets, decision_analysis, and teams tables
    - Added organization access checks to existing policies
*/

-- Update decisions table policies
CREATE OR REPLACE FUNCTION can_access_organisation_resource(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    -- User is the organization owner
    EXISTS (
      SELECT 1
      FROM organisations
      WHERE id = org_id AND owner_id = auth.uid()
    ) OR
    -- User is an organization member
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_id = org_id AND user_id = auth.uid()
    )
  );
END;
$$;

-- Update decisions table policies
DROP POLICY IF EXISTS "Enable read for own decisions" ON decisions;
CREATE POLICY "Enable read for own and organization decisions" ON decisions
  FOR SELECT
  USING (
    (auth.uid() = user_id) OR
    (organisation_id IS NOT NULL AND can_access_organisation_resource(organisation_id))
  );

DROP POLICY IF EXISTS "Enable update for own decisions" ON decisions;
CREATE POLICY "Enable update for own and organization decisions" ON decisions
  FOR UPDATE
  USING (
    (auth.uid() = user_id) OR
    (organisation_id IS NOT NULL AND can_access_organisation_resource(organisation_id))
  )
  WITH CHECK (
    (auth.uid() = user_id) OR
    (organisation_id IS NOT NULL AND can_access_organisation_resource(organisation_id))
  );

-- Update criteria_sets table policies
DROP POLICY IF EXISTS "Enable read for own and team criteria sets" ON criteria_sets;
CREATE POLICY "Enable read for own, team, and organization criteria sets" ON criteria_sets
  FOR SELECT
  USING (
    (user_id = auth.uid()) OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM team_members
      WHERE team_members.team_id = criteria_sets.team_id AND team_members.user_id = auth.uid()
    )) OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM teams
      WHERE teams.id = criteria_sets.team_id AND teams.organisation_id IS NOT NULL AND
      can_access_organisation_resource(teams.organisation_id)
    ))
  );

-- Update decision_analysis table policies
DROP POLICY IF EXISTS "Enable read access for decision owners" ON decision_analysis;
CREATE POLICY "Enable read access for decision owners and organization members" ON decision_analysis
  FOR SELECT
  USING (
    validate_decision_ownership(decision_id) OR
    (organisation_id IS NOT NULL AND can_access_organisation_resource(organisation_id))
  );

DROP POLICY IF EXISTS "Enable update access for decision owners" ON decision_analysis;
CREATE POLICY "Enable update access for decision owners and organization members" ON decision_analysis
  FOR UPDATE
  USING (
    validate_decision_ownership(decision_id) OR
    (organisation_id IS NOT NULL AND can_access_organisation_resource(organisation_id))
  )
  WITH CHECK (
    validate_decision_ownership(decision_id) OR
    (organisation_id IS NOT NULL AND can_access_organisation_resource(organisation_id))
  );

-- Update teams table policies
DROP POLICY IF EXISTS "Select own teams" ON teams;
CREATE POLICY "Select own and organization teams" ON teams
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1
      FROM team_members
      WHERE team_members.team_id = teams.id AND team_members.user_id = auth.uid()
    ) OR
    (organisation_id IS NOT NULL AND can_access_organisation_resource(organisation_id))
  );

-- Update team_members table policies
DROP POLICY IF EXISTS "team_members_select" ON team_members;
CREATE POLICY "team_members_select" ON team_members
  FOR SELECT
  USING (
    (user_id = auth.uid()) OR
    check_team_admin_access(team_id) OR
    check_team_member_access(team_id) OR
    EXISTS (
      SELECT 1
      FROM teams
      WHERE teams.id = team_id AND teams.organisation_id IS NOT NULL AND
      can_access_organisation_resource(teams.organisation_id)
    )
  );