/*
  # Validation Queries for Organization Migration

  This file contains SQL queries to validate the migration results.
  These queries should be run after each migration phase to ensure data integrity.
*/

-- 1. Validate organization creation
-- Check if all users who own teams or decisions have an organization
SELECT 
  u.id, 
  u.email, 
  COUNT(DISTINCT t.id) AS team_count, 
  COUNT(DISTINCT d.id) AS decision_count,
  EXISTS (SELECT 1 FROM organisations o WHERE o.owner_id = u.id) AS has_organization
FROM 
  auth.users u
LEFT JOIN 
  teams t ON t.created_by = u.id
LEFT JOIN 
  decisions d ON d.user_id = u.id
WHERE 
  t.id IS NOT NULL OR d.id IS NOT NULL
GROUP BY 
  u.id, u.email
HAVING 
  NOT EXISTS (SELECT 1 FROM organisations o WHERE o.owner_id = u.id)
ORDER BY 
  team_count + decision_count DESC;

-- 2. Validate team organization backfilling
-- Check if all teams have an organization_id
SELECT 
  t.id, 
  t.name, 
  t.created_by, 
  t.organisation_id,
  u.email AS creator_email
FROM 
  teams t
JOIN 
  auth.users u ON t.created_by = u.id
WHERE 
  t.organisation_id IS NULL;

-- 3. Validate decision organization backfilling
-- Check if all decisions have an organization_id
SELECT 
  d.id, 
  d.title, 
  d.user_id, 
  d.organisation_id,
  u.email AS user_email
FROM 
  decisions d
JOIN 
  auth.users u ON d.user_id = u.id
WHERE 
  d.organisation_id IS NULL;

-- 4. Validate criteria_sets organization backfilling
-- Check if all criteria_sets have an organization_id
SELECT 
  cs.id, 
  cs.name, 
  cs.user_id, 
  cs.team_id, 
  cs.organisation_id,
  u.email AS user_email
FROM 
  criteria_sets cs
JOIN 
  auth.users u ON cs.user_id = u.id
WHERE 
  cs.organisation_id IS NULL;

-- 5. Validate decision_analysis organization backfilling
-- Check if all decision_analysis records have an organization_id
SELECT 
  da.id, 
  da.decision_id, 
  da.organisation_id,
  d.title AS decision_title,
  d.organisation_id AS decision_org_id
FROM 
  decision_analysis da
JOIN 
  decisions d ON da.decision_id = d.id
WHERE 
  da.organisation_id IS NULL;

-- 6. Validate invitations organization backfilling
-- Check if all invitations have an organization_id
SELECT 
  i.id, 
  i.email, 
  i.team_id, 
  i.invited_by, 
  i.organisation_id,
  t.name AS team_name,
  t.organisation_id AS team_org_id,
  u.email AS inviter_email
FROM 
  invitations i
LEFT JOIN 
  teams t ON i.team_id = t.id
LEFT JOIN 
  auth.users u ON i.invited_by = u.id
WHERE 
  i.organisation_id IS NULL;

-- 7. Cross-validation: Check for organization ID consistency
-- Verify that teams and their associated data have consistent organization IDs
SELECT 
  t.id AS team_id, 
  t.name AS team_name, 
  t.organisation_id AS team_org_id,
  cs.id AS criteria_set_id, 
  cs.name AS criteria_set_name, 
  cs.organisation_id AS criteria_set_org_id
FROM 
  teams t
JOIN 
  criteria_sets cs ON cs.team_id = t.id
WHERE 
  t.organisation_id IS NOT NULL AND 
  cs.organisation_id IS NOT NULL AND 
  t.organisation_id != cs.organisation_id;

-- 8. Cross-validation: Check for decision organization ID consistency
-- Verify that decisions and their analysis records have consistent organization IDs
SELECT 
  d.id AS decision_id, 
  d.title AS decision_title, 
  d.organisation_id AS decision_org_id,
  da.id AS analysis_id, 
  da.organisation_id AS analysis_org_id
FROM 
  decisions d
JOIN 
  decision_analysis da ON da.decision_id = d.id
WHERE 
  d.organisation_id IS NOT NULL AND 
  da.organisation_id IS NOT NULL AND 
  d.organisation_id != da.organisation_id;

-- 9. Summary statistics
-- Get counts of records before and after migration
SELECT 
  'organisations' AS table_name, 
  COUNT(*) AS record_count 
FROM 
  organisations
UNION ALL
SELECT 
  'teams with org_id' AS table_name, 
  COUNT(*) AS record_count 
FROM 
  teams 
WHERE 
  organisation_id IS NOT NULL
UNION ALL
SELECT 
  'teams without org_id' AS table_name, 
  COUNT(*) AS record_count 
FROM 
  teams 
WHERE 
  organisation_id IS NULL
UNION ALL
SELECT 
  'decisions with org_id' AS table_name, 
  COUNT(*) AS record_count 
FROM 
  decisions 
WHERE 
  organisation_id IS NOT NULL
UNION ALL
SELECT 
  'decisions without org_id' AS table_name, 
  COUNT(*) AS record_count 
FROM 
  decisions 
WHERE 
  organisation_id IS NULL
UNION ALL
SELECT 
  'criteria_sets with org_id' AS table_name, 
  COUNT(*) AS record_count 
FROM 
  criteria_sets 
WHERE 
  organisation_id IS NOT NULL
UNION ALL
SELECT 
  'criteria_sets without org_id' AS table_name, 
  COUNT(*) AS record_count 
FROM 
  criteria_sets 
WHERE 
  organisation_id IS NULL
UNION ALL
SELECT 
  'decision_analysis with org_id' AS table_name, 
  COUNT(*) AS record_count 
FROM 
  decision_analysis 
WHERE 
  organisation_id IS NOT NULL
UNION ALL
SELECT 
  'decision_analysis without org_id' AS table_name, 
  COUNT(*) AS record_count 
FROM 
  decision_analysis 
WHERE 
  organisation_id IS NULL
UNION ALL
SELECT 
  'invitations with org_id' AS table_name, 
  COUNT(*) AS record_count 
FROM 
  invitations 
WHERE 
  organisation_id IS NOT NULL
UNION ALL
SELECT 
  'invitations without org_id' AS table_name, 
  COUNT(*) AS record_count 
FROM 
  invitations 
WHERE 
  organisation_id IS NULL;