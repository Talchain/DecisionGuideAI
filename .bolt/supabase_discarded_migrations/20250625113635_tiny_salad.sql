/*
  # Rollback Organization Migration

  This file contains SQL statements to rollback the organization migration if needed.
  CAUTION: Running this will remove organization associations from all tables.
  Make sure you have a backup before proceeding.
*/

-- 1. Rollback invitations organization_id
UPDATE invitations
SET organisation_id = NULL
WHERE organisation_id IS NOT NULL;

-- 2. Rollback decision_analysis organization_id
UPDATE decision_analysis
SET organisation_id = NULL
WHERE organisation_id IS NOT NULL;

-- 3. Rollback criteria_sets organization_id
UPDATE criteria_sets
SET organisation_id = NULL
WHERE organisation_id IS NOT NULL;

-- 4. Rollback decisions organization_id
UPDATE decisions
SET organisation_id = NULL
WHERE organisation_id IS NOT NULL;

-- 5. Rollback teams organization_id
UPDATE teams
SET organisation_id = NULL
WHERE organisation_id IS NOT NULL;

-- 6. Remove organizations created during migration
DELETE FROM organisations
WHERE settings->>'created_during_migration' = 'true';

-- 7. Validation query to confirm rollback
SELECT 
  'organisations created during migration' AS entity, 
  COUNT(*) AS count 
FROM 
  organisations
WHERE 
  settings->>'created_during_migration' = 'true'
UNION ALL
SELECT 
  'teams with org_id' AS entity, 
  COUNT(*) AS count 
FROM 
  teams 
WHERE 
  organisation_id IS NOT NULL
UNION ALL
SELECT 
  'decisions with org_id' AS entity, 
  COUNT(*) AS count 
FROM 
  decisions 
WHERE 
  organisation_id IS NOT NULL
UNION ALL
SELECT 
  'criteria_sets with org_id' AS entity, 
  COUNT(*) AS count 
FROM 
  criteria_sets 
WHERE 
  organisation_id IS NOT NULL
UNION ALL
SELECT 
  'decision_analysis with org_id' AS entity, 
  COUNT(*) AS count 
FROM 
  decision_analysis 
WHERE 
  organisation_id IS NOT NULL
UNION ALL
SELECT 
  'invitations with org_id' AS entity, 
  COUNT(*) AS count 
FROM 
  invitations 
WHERE 
  organisation_id IS NOT NULL;