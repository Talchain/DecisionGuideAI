/*
  # Organization RLS Policies

  1. New Policies
    - Adds RLS policies for organisations table
    - Adds RLS policies for organisation_members table
    - Updates RLS policies for teams, decisions, criteria_sets, and decision_analysis tables
  
  2. Changes
    - Ensures proper access control based on organization membership and roles
  
  3. Security
    - Enforces organization-based access control
    - Prevents cross-organization data access
*/

-- Organizations table policies
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- Owners can delete their organizations
CREATE POLICY "Owners can delete their organizations"
  ON organisations
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Owners can update their organizations
CREATE POLICY "Owners can update their organizations"
  ON organisations
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Users can create organizations
CREATE POLICY "Users can create organizations"
  ON organisations
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Users can view their organizations
CREATE POLICY "Users can view their organizations"
  ON organisations
  FOR SELECT
  TO authenticated
  USING (
    (owner_id = auth.uid()) OR 
    (EXISTS (
      SELECT 1 FROM organisation_members
      WHERE 
        organisation_members.organisation_id = organisations.id AND 
        organisation_members.user_id = auth.uid()
    ))
  );

-- Organization members table policies
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;

-- Organization owners and admins can manage members
CREATE POLICY "Organization owners and admins can manage members"
  ON organisation_members
  FOR ALL
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM organisations
      WHERE 
        organisations.id = organisation_members.organisation_id AND 
        organisations.owner_id = auth.uid()
    )) OR 
    (EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE 
        om.organisation_id = organisation_members.organisation_id AND 
        om.user_id = auth.uid() AND 
        om.role IN ('owner', 'admin')
    ))
  );

-- Users can view members of their organizations
CREATE POLICY "Users can view members of their organizations"
  ON organisation_members
  FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid()) OR 
    (EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE 
        om.organisation_id = organisation_members.organisation_id AND 
        om.user_id = auth.uid()
    ))
  );

-- Update teams table policies to include organization context
DROP POLICY IF EXISTS "Create own teams" ON teams;
DROP POLICY IF EXISTS "Delete own teams" ON teams;
DROP POLICY IF EXISTS "Insert own teams" ON teams;
DROP POLICY IF EXISTS "Select own teams" ON teams;
DROP POLICY IF EXISTS "Update own teams" ON teams;

-- Teams creation policy
CREATE POLICY "Create teams in your organization"
  ON teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    (
      organisation_id IS NULL OR
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin', 'member')
      )
    )
  );

-- Teams select policy
CREATE POLICY "View teams you own or are a member of"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE 
        team_members.team_id = teams.id AND
        team_members.user_id = auth.uid()
    ) OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = teams.organisation_id AND
          organisation_members.user_id = auth.uid()
      )
    )
  );

-- Teams update policy
CREATE POLICY "Update teams you own or admin"
  ON teams
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = teams.organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    created_by = auth.uid() OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = teams.organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin')
      )
    )
  );

-- Teams delete policy
CREATE POLICY "Delete teams you own or admin"
  ON teams
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = teams.organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin')
      )
    )
  );

-- Update decisions table policies to include organization context
DROP POLICY IF EXISTS "Enable delete for own decisions" ON decisions;
DROP POLICY IF EXISTS "Enable insert for own decisions" ON decisions;
DROP POLICY IF EXISTS "Enable read for own decisions" ON decisions;
DROP POLICY IF EXISTS "Enable update for own decisions" ON decisions;

-- Decisions insert policy
CREATE POLICY "Create decisions in your organization"
  ON decisions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    (
      organisation_id IS NULL OR
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = organisation_id AND
          organisation_members.user_id = auth.uid()
      )
    )
  );

-- Decisions select policy
CREATE POLICY "View decisions you own or have access to"
  ON decisions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM decision_collaborators
      WHERE 
        decision_collaborators.decision_id = decisions.id AND
        decision_collaborators.user_id = auth.uid() AND
        decision_collaborators.status = 'active'
    ) OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = decisions.organisation_id AND
          organisation_members.user_id = auth.uid()
      )
    )
  );

-- Decisions update policy
CREATE POLICY "Update decisions you own or admin"
  ON decisions
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = decisions.organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = decisions.organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin')
      )
    )
  );

-- Decisions delete policy
CREATE POLICY "Delete decisions you own or admin"
  ON decisions
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = decisions.organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin')
      )
    )
  );

-- Update criteria_sets table policies to include organization context
DROP POLICY IF EXISTS "Enable delete for owners and team admins" ON criteria_sets;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON criteria_sets;
DROP POLICY IF EXISTS "Enable read for own and team criteria sets" ON criteria_sets;
DROP POLICY IF EXISTS "Enable update for owners and team admins" ON criteria_sets;

-- Criteria sets insert policy
CREATE POLICY "Create criteria sets in your organization"
  ON criteria_sets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    (
      (team_id IS NULL AND organisation_id IS NULL) OR
      (
        team_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM team_members
          WHERE 
            team_members.team_id = criteria_sets.team_id AND
            team_members.user_id = auth.uid() AND
            team_members.role = 'admin'
        )
      ) OR
      (
        organisation_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM organisation_members
          WHERE 
            organisation_members.organisation_id = criteria_sets.organisation_id AND
            organisation_members.user_id = auth.uid() AND
            organisation_members.role IN ('owner', 'admin')
        )
      )
    )
  );

-- Criteria sets select policy
CREATE POLICY "View criteria sets you own or have access to"
  ON criteria_sets
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    (
      team_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM team_members
        WHERE 
          team_members.team_id = criteria_sets.team_id AND
          team_members.user_id = auth.uid()
      )
    ) OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = criteria_sets.organisation_id AND
          organisation_members.user_id = auth.uid()
      )
    )
  );

-- Criteria sets update policy
CREATE POLICY "Update criteria sets you own or admin"
  ON criteria_sets
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    (
      team_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM team_members
        WHERE 
          team_members.team_id = criteria_sets.team_id AND
          team_members.user_id = auth.uid() AND
          team_members.role = 'admin'
      )
    ) OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = criteria_sets.organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    (
      team_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM team_members
        WHERE 
          team_members.team_id = criteria_sets.team_id AND
          team_members.user_id = auth.uid() AND
          team_members.role = 'admin'
      )
    ) OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = criteria_sets.organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin')
      )
    )
  );

-- Criteria sets delete policy
CREATE POLICY "Delete criteria sets you own or admin"
  ON criteria_sets
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    (
      team_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM team_members
        WHERE 
          team_members.team_id = criteria_sets.team_id AND
          team_members.user_id = auth.uid() AND
          team_members.role = 'admin'
      )
    ) OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = criteria_sets.organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin')
      )
    )
  );

-- Update decision_analysis table policies to include organization context
DROP POLICY IF EXISTS "Enable delete access for decision owners" ON decision_analysis;
DROP POLICY IF EXISTS "Enable insert access for decision owners" ON decision_analysis;
DROP POLICY IF EXISTS "Enable read access for decision owners" ON decision_analysis;
DROP POLICY IF EXISTS "Enable update access for decision owners" ON decision_analysis;

-- Decision analysis insert policy
CREATE POLICY "Create analysis for decisions you own"
  ON decision_analysis
  FOR INSERT
  TO authenticated
  WITH CHECK (
    validate_decision_ownership(decision_id) OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = decision_analysis.organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin')
      )
    )
  );

-- Decision analysis select policy
CREATE POLICY "View analysis for decisions you have access to"
  ON decision_analysis
  FOR SELECT
  TO authenticated
  USING (
    validate_decision_ownership(decision_id) OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = decision_analysis.organisation_id AND
          organisation_members.user_id = auth.uid()
      )
    )
  );

-- Decision analysis update policy
CREATE POLICY "Update analysis for decisions you own"
  ON decision_analysis
  FOR UPDATE
  TO authenticated
  USING (
    validate_decision_ownership(decision_id) OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = decision_analysis.organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    validate_decision_ownership(decision_id) OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = decision_analysis.organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin')
      )
    )
  );

-- Decision analysis delete policy
CREATE POLICY "Delete analysis for decisions you own"
  ON decision_analysis
  FOR DELETE
  TO authenticated
  USING (
    validate_decision_ownership(decision_id) OR
    (
      organisation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM organisation_members
        WHERE 
          organisation_members.organisation_id = decision_analysis.organisation_id AND
          organisation_members.user_id = auth.uid() AND
          organisation_members.role IN ('owner', 'admin')
      )
    )
  );