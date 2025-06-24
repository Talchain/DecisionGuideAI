/*
  # Data Migration for Organizations

  This migration creates default organizations for existing users and associates
  teams and decisions with these organizations.

  1. Creates default organizations for users with teams or decisions
  2. Updates teams to associate with organizations
  3. Updates decisions to associate with organizations and teams
  4. Performs validation checks
*/

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

-- Add NOT NULL constraints after migration (for new data)
-- Note: We're not making existing columns NOT NULL to preserve flexibility for legacy data
-- But we can add constraints for new records through RLS policies and application logic

-- Final completion notice wrapped in a DO block to avoid syntax error
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully. Default organizations created and data migrated.';
END $$;