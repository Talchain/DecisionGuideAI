/*
  # Organization Structure Migration
  
  1. New Tables
    - `organisations` table with basic fields
    - `organisation_members` table for user-organization relationships
  
  2. Schema Updates
    - Add `organisation_id` to existing tables (teams, decisions, etc.)
    - Create default organizations for existing users
    - Associate existing teams and decisions with organizations
  
  3. Data Migration
    - Create default organizations for users with existing data
    - Link teams to organizations
    - Link decisions to teams and organizations
*/

-- First create the organisations table
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create organisation_members table for many-to-many relationship
CREATE TABLE IF NOT EXISTS organisation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organisation_id, user_id)
);

-- Add organisation_id to teams table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'organisation_id'
  ) THEN
    ALTER TABLE teams ADD COLUMN organisation_id UUID REFERENCES organisations(id);
    CREATE INDEX IF NOT EXISTS idx_teams_organisation_id ON teams(organisation_id);
  END IF;
END $$;

-- Add organisation_id to decisions table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'decisions' AND column_name = 'organisation_id'
  ) THEN
    ALTER TABLE decisions ADD COLUMN organisation_id UUID REFERENCES organisations(id);
    CREATE INDEX IF NOT EXISTS idx_decisions_organisation_id ON decisions(organisation_id);
  END IF;
END $$;

-- Add organisation_id to decision_analysis table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'decision_analysis' AND column_name = 'organisation_id'
  ) THEN
    ALTER TABLE decision_analysis ADD COLUMN organisation_id UUID REFERENCES organisations(id);
    CREATE INDEX IF NOT EXISTS idx_decision_analysis_organisation_id ON decision_analysis(organisation_id);
  END IF;
END $$;

-- Add organisation_id to invitations table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitations' AND column_name = 'organisation_id'
  ) THEN
    ALTER TABLE invitations ADD COLUMN organisation_id UUID REFERENCES organisations(id);
    CREATE INDEX IF NOT EXISTS idx_invitations_organisation_id ON invitations(organisation_id);
  END IF;
END $$;

-- Create default organizations for existing users who have teams or decisions
DO $$
DECLARE
  user_record RECORD;
  org_id uuid;
  default_team_id uuid;
BEGIN
  -- Create default organizations for users who have teams or decisions
  FOR user_record IN 
    SELECT DISTINCT u.id, u.email
    FROM auth.users u
    WHERE u.id IN (
      SELECT DISTINCT created_by FROM teams WHERE created_by IS NOT NULL
      UNION
      SELECT DISTINCT user_id FROM decisions WHERE user_id IS NOT NULL
    )
  LOOP
    -- Create default organization for this user
    INSERT INTO organisations (
      name, 
      slug, 
      description, 
      owner_id
    ) VALUES (
      COALESCE(split_part(user_record.email, '@', 1), 'user') || '''s Organization',
      COALESCE(split_part(user_record.email, '@', 1), 'user') || '-org-' || substr(user_record.id::text, 1, 8),
      'Default organization created during migration',
      user_record.id
    ) RETURNING id INTO org_id;

    -- Add user as organization member with owner role
    INSERT INTO organisation_members (
      organisation_id,
      user_id,
      role
    ) VALUES (
      org_id,
      user_record.id,
      'owner'
    );

    -- Update teams created by this user
    UPDATE teams 
    SET organisation_id = org_id 
    WHERE created_by = user_record.id 
    AND organisation_id IS NULL;

    -- Create a default team for this user if they don't have any teams
    IF NOT EXISTS (SELECT 1 FROM teams WHERE created_by = user_record.id) THEN
      INSERT INTO teams (
        name,
        description,
        created_by,
        organisation_id
      ) VALUES (
        'Default Team',
        'Default team created during migration',
        user_record.id,
        org_id
      ) RETURNING id INTO default_team_id;
    ELSE
      -- Get the first team for this user as default
      SELECT id INTO default_team_id 
      FROM teams 
      WHERE created_by = user_record.id 
      ORDER BY created_at 
      LIMIT 1;
    END IF;

    -- Update decisions created by this user
    UPDATE decisions 
    SET 
      organisation_id = org_id,
      team_id = COALESCE(team_id, default_team_id)
    WHERE user_id = user_record.id 
    AND organisation_id IS NULL;

    -- Update decision_analysis for this user's decisions
    UPDATE decision_analysis 
    SET organisation_id = org_id
    WHERE decision_id IN (
      SELECT id FROM decisions WHERE user_id = user_record.id
    )
    AND organisation_id IS NULL;

    -- Update invitations sent by this user
    UPDATE invitations 
    SET organisation_id = org_id
    WHERE invited_by = user_record.id 
    AND organisation_id IS NULL;

    RAISE NOTICE 'Created default organization % for user %', org_id, user_record.email;
  END LOOP;
END $$;

-- Update any remaining teams without organisation_id (orphaned teams)
UPDATE teams 
SET organisation_id = (
  SELECT o.id 
  FROM organisations o 
  WHERE o.owner_id = teams.created_by 
  LIMIT 1
)
WHERE organisation_id IS NULL 
AND created_by IS NOT NULL;

-- Update any remaining decisions without organisation_id
UPDATE decisions 
SET organisation_id = (
  SELECT o.id 
  FROM organisations o 
  WHERE o.owner_id = decisions.user_id 
  LIMIT 1
)
WHERE organisation_id IS NULL 
AND user_id IS NOT NULL;

-- Update any decisions without team_id by assigning them to the user's first team
UPDATE decisions 
SET team_id = (
  SELECT t.id 
  FROM teams t 
  WHERE t.created_by = decisions.user_id 
  ORDER BY t.created_at 
  LIMIT 1
)
WHERE team_id IS NULL 
AND user_id IS NOT NULL;

-- Validation: Check that all teams now have organisation_id
DO $$
DECLARE
  orphaned_teams_count integer;
BEGIN
  SELECT COUNT(*) INTO orphaned_teams_count 
  FROM teams 
  WHERE organisation_id IS NULL;
  
  IF orphaned_teams_count > 0 THEN
    RAISE WARNING 'Found % teams without organisation_id after migration', orphaned_teams_count;
  ELSE
    RAISE NOTICE 'All teams successfully associated with organizations';
  END IF;
END $$;

-- Validation: Check that all decisions now have organisation_id
DO $$
DECLARE
  orphaned_decisions_count integer;
BEGIN
  SELECT COUNT(*) INTO orphaned_decisions_count 
  FROM decisions 
  WHERE organisation_id IS NULL;
  
  IF orphaned_decisions_count > 0 THEN
    RAISE WARNING 'Found % decisions without organisation_id after migration', orphaned_decisions_count;
  ELSE
    RAISE NOTICE 'All decisions successfully associated with organizations';
  END IF;
END $$;

-- Add RLS policies for organisations table
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view organizations they are members of
CREATE POLICY "Users can view their organizations" 
  ON organisations
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM organisation_members 
      WHERE organisation_id = organisations.id AND user_id = auth.uid()
    )
  );

-- Policy: Only owners can update their organizations
CREATE POLICY "Owners can update their organizations" 
  ON organisations
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Policy: Only owners can delete their organizations
CREATE POLICY "Owners can delete their organizations" 
  ON organisations
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Policy: Authenticated users can create organizations
CREATE POLICY "Users can create organizations" 
  ON organisations
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Add RLS policies for organisation_members table
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view members of organizations they belong to
CREATE POLICY "Users can view members of their organizations" 
  ON organisation_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM organisation_members 
      WHERE organisation_id = organisation_members.organisation_id AND user_id = auth.uid()
    )
  );

-- Policy: Organization owners and admins can manage members
CREATE POLICY "Organization owners and admins can manage members" 
  ON organisation_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organisations 
      WHERE id = organisation_members.organisation_id AND owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM organisation_members 
      WHERE organisation_id = organisation_members.organisation_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Final completion notice
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully. Organizations structure created and data migrated.';
END $$;