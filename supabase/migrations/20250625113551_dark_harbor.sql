/*
  # Backfill Teams with Organization IDs

  1. New Tables
    - No new tables created in this migration
  
  2. Changes
    - Updates all existing teams to link to their creator's organization
    - Uses a DO block to safely update teams only if they don't already have an organization_id
  
  3. Security
    - No security changes in this migration
*/

-- Update existing teams to link to their creator's organization
DO $$
DECLARE
  team_record RECORD;
  org_id uuid;
BEGIN
  -- Get all teams that don't have an organization_id yet
  FOR team_record IN (
    SELECT t.id, t.name, t.created_by
    FROM teams t
    WHERE t.organisation_id IS NULL
  ) LOOP
    -- Find the organization owned by the team creator
    SELECT id INTO org_id
    FROM organisations
    WHERE owner_id = team_record.created_by
    LIMIT 1;
    
    -- If an organization was found, update the team
    IF org_id IS NOT NULL THEN
      UPDATE teams
      SET organisation_id = org_id,
          updated_at = NOW()
      WHERE id = team_record.id;
      
      -- Log the update for audit purposes
      RAISE NOTICE 'Updated team % to organization %', team_record.name, org_id;
    ELSE
      -- Log teams that couldn't be updated
      RAISE WARNING 'Could not find organization for team % (created by %)', 
                   team_record.name, team_record.created_by;
    END IF;
  END LOOP;
END $$;