/*
  # Update Core Data Tables with Organization ID

  1. Schema Changes
    - Add `organisation_id` column to core data tables:
      - decisions
      - decision_analysis  
      - criteria_templates
      - invitations
    - Add foreign key constraints and indexes

  2. Security Updates
    - Update RLS policies to incorporate organization-level access
    - Ensure data is only accessible by organization members

  3. Data Migration Preparation
    - Add columns as nullable initially to allow for data migration
    - Will be made NOT NULL after migration is complete (where appropriate)
*/

-- Update decisions table
ALTER TABLE decisions 
ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS decisions_organisation_id_idx ON decisions(organisation_id);

-- Update decision_analysis table
ALTER TABLE decision_analysis 
ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS decision_analysis_organisation_id_idx ON decision_analysis(organisation_id);

-- Update criteria_templates table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'criteria_templates') THEN
    ALTER TABLE criteria_templates 
    ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS criteria_templates_organisation_id_idx ON criteria_templates(organisation_id);
  END IF;
END $$;

-- Update invitations table
ALTER TABLE invitations 
ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS invitations_organisation_id_idx ON invitations(organisation_id);

-- Update decisions RLS policies
DROP POLICY IF EXISTS "Users can read their own decisions" ON decisions;
DROP POLICY IF EXISTS "Users can create decisions" ON decisions;
DROP POLICY IF EXISTS "Users can update their own decisions" ON decisions;
DROP POLICY IF EXISTS "Users can delete their own decisions" ON decisions;

-- New RLS policies for decisions with organization context
CREATE POLICY "Users can read decisions in their organizations"
  ON decisions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR organisation_id IN (
      SELECT organisation_id 
      FROM organisation_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can create decisions"
  ON decisions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      organisation_id IS NULL -- Allow legacy decisions without org
      OR organisation_id IN (
        SELECT organisation_id 
        FROM organisation_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Decision owners and org admins can update decisions"
  ON decisions
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR organisation_id IN (
      SELECT organisation_id 
      FROM organisation_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Decision owners and org admins can delete decisions"
  ON decisions
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR organisation_id IN (
      SELECT organisation_id 
      FROM organisation_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Update decision_analysis RLS policies
DROP POLICY IF EXISTS "Users can read their decision analysis" ON decision_analysis;
DROP POLICY IF EXISTS "Users can create decision analysis" ON decision_analysis;
DROP POLICY IF EXISTS "Users can update their decision analysis" ON decision_analysis;

-- New RLS policies for decision_analysis with organization context
CREATE POLICY "Users can read decision analysis in their organizations"
  ON decision_analysis
  FOR SELECT
  TO authenticated
  USING (
    decision_id IN (
      SELECT id FROM decisions 
      WHERE user_id = auth.uid()
      OR organisation_id IN (
        SELECT organisation_id 
        FROM organisation_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage decision analysis in their organizations"
  ON decision_analysis
  FOR ALL
  TO authenticated
  USING (
    decision_id IN (
      SELECT id FROM decisions 
      WHERE user_id = auth.uid()
      OR organisation_id IN (
        SELECT organisation_id 
        FROM organisation_members 
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
      )
    )
  );

-- Update invitations RLS policies
DROP POLICY IF EXISTS "Users can read invitations sent to them" ON invitations;
DROP POLICY IF EXISTS "Users can read invitations they sent" ON invitations;
DROP POLICY IF EXISTS "Users can create invitations" ON invitations;
DROP POLICY IF EXISTS "Users can update invitations" ON invitations;

-- New RLS policies for invitations with organization context
CREATE POLICY "Users can read invitations in their organizations"
  ON invitations
  FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR invited_by = auth.uid()
    OR (
      organisation_id IS NOT NULL 
      AND organisation_id IN (
        SELECT organisation_id 
        FROM organisation_members 
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY "Organization admins can manage invitations"
  ON invitations
  FOR ALL
  TO authenticated
  USING (
    invited_by = auth.uid()
    OR (
      organisation_id IS NOT NULL 
      AND organisation_id IN (
        SELECT organisation_id 
        FROM organisation_members 
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
      )
    )
  );