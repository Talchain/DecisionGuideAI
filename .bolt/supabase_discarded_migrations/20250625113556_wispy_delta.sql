/*
  # Backfill Core Data with Organization and Team IDs

  1. New Tables
    - No new tables created in this migration
  
  2. Changes
    - Updates decisions table to link to the user's organization
    - Updates criteria_sets table to link to the correct organization
    - Updates decision_analysis table to link to the same organization as its decision
    - Updates invitations table to link to the correct organization based on team or inviter
  
  3. Security
    - No security changes in this migration
*/

-- Backfill decisions with organization_id
DO $$
DECLARE
  decision_record RECORD;
  org_id uuid;
BEGIN
  -- Get all decisions that don't have an organization_id yet
  FOR decision_record IN (
    SELECT d.id, d.title, d.user_id
    FROM decisions d
    WHERE d.organisation_id IS NULL
  ) LOOP
    -- Find the organization owned by the decision creator
    SELECT id INTO org_id
    FROM organisations
    WHERE owner_id = decision_record.user_id
    LIMIT 1;
    
    -- If an organization was found, update the decision
    IF org_id IS NOT NULL THEN
      UPDATE decisions
      SET organisation_id = org_id,
          updated_at = NOW()
      WHERE id = decision_record.id;
      
      -- Log the update for audit purposes
      RAISE NOTICE 'Updated decision % to organization %', decision_record.title, org_id;
    ELSE
      -- Log decisions that couldn't be updated
      RAISE WARNING 'Could not find organization for decision % (created by %)', 
                   decision_record.title, decision_record.user_id;
    END IF;
  END LOOP;
END $$;

-- Backfill criteria_sets with organization_id
DO $$
DECLARE
  criteria_set_record RECORD;
  org_id uuid;
  team_org_id uuid;
BEGIN
  -- Get all criteria_sets that don't have an organization_id yet
  FOR criteria_set_record IN (
    SELECT cs.id, cs.name, cs.user_id, cs.team_id
    FROM criteria_sets cs
    WHERE cs.organisation_id IS NULL
  ) LOOP
    -- If the criteria set is associated with a team, use the team's organization
    IF criteria_set_record.team_id IS NOT NULL THEN
      SELECT organisation_id INTO team_org_id
      FROM teams
      WHERE id = criteria_set_record.team_id;
      
      IF team_org_id IS NOT NULL THEN
        UPDATE criteria_sets
        SET organisation_id = team_org_id,
            updated_at = NOW()
        WHERE id = criteria_set_record.id;
        
        RAISE NOTICE 'Updated criteria set % to team organization %', 
                    criteria_set_record.name, team_org_id;
        CONTINUE;
      END IF;
    END IF;
    
    -- Otherwise, find the organization owned by the criteria set creator
    SELECT id INTO org_id
    FROM organisations
    WHERE owner_id = criteria_set_record.user_id
    LIMIT 1;
    
    -- If an organization was found, update the criteria set
    IF org_id IS NOT NULL THEN
      UPDATE criteria_sets
      SET organisation_id = org_id,
          updated_at = NOW()
      WHERE id = criteria_set_record.id;
      
      RAISE NOTICE 'Updated criteria set % to user organization %', 
                  criteria_set_record.name, org_id;
    ELSE
      -- Log criteria sets that couldn't be updated
      RAISE WARNING 'Could not find organization for criteria set % (created by %)', 
                   criteria_set_record.name, criteria_set_record.user_id;
    END IF;
  END LOOP;
END $$;

-- Backfill decision_analysis with organization_id
DO $$
DECLARE
  analysis_record RECORD;
  decision_org_id uuid;
BEGIN
  -- Get all decision_analysis records that don't have an organization_id yet
  FOR analysis_record IN (
    SELECT da.id, da.decision_id
    FROM decision_analysis da
    WHERE da.organisation_id IS NULL
  ) LOOP
    -- Find the organization of the associated decision
    SELECT organisation_id INTO decision_org_id
    FROM decisions
    WHERE id = analysis_record.decision_id;
    
    -- If an organization was found, update the analysis record
    IF decision_org_id IS NOT NULL THEN
      UPDATE decision_analysis
      SET organisation_id = decision_org_id,
          updated_at = NOW()
      WHERE id = analysis_record.id;
      
      RAISE NOTICE 'Updated decision analysis % to organization %', 
                  analysis_record.id, decision_org_id;
    ELSE
      -- Log analysis records that couldn't be updated
      RAISE WARNING 'Could not find organization for decision analysis % (decision %)', 
                   analysis_record.id, analysis_record.decision_id;
    END IF;
  END LOOP;
END $$;

-- Backfill invitations with organization_id
DO $$
DECLARE
  invitation_record RECORD;
  team_org_id uuid;
  inviter_org_id uuid;
BEGIN
  -- Get all invitations that don't have an organization_id yet
  FOR invitation_record IN (
    SELECT i.id, i.email, i.team_id, i.invited_by
    FROM invitations i
    WHERE i.organisation_id IS NULL
  ) LOOP
    -- If the invitation is for a team, use the team's organization
    IF invitation_record.team_id IS NOT NULL THEN
      SELECT organisation_id INTO team_org_id
      FROM teams
      WHERE id = invitation_record.team_id;
      
      IF team_org_id IS NOT NULL THEN
        UPDATE invitations
        SET organisation_id = team_org_id
        WHERE id = invitation_record.id;
        
        RAISE NOTICE 'Updated invitation for % to team organization %', 
                    invitation_record.email, team_org_id;
        CONTINUE;
      END IF;
    END IF;
    
    -- Otherwise, find the organization of the inviter
    IF invitation_record.invited_by IS NOT NULL THEN
      SELECT o.id INTO inviter_org_id
      FROM organisations o
      WHERE o.owner_id = invitation_record.invited_by
      LIMIT 1;
      
      IF inviter_org_id IS NOT NULL THEN
        UPDATE invitations
        SET organisation_id = inviter_org_id
        WHERE id = invitation_record.id;
        
        RAISE NOTICE 'Updated invitation for % to inviter organization %', 
                    invitation_record.email, inviter_org_id;
      ELSE
        -- Log invitations that couldn't be updated
        RAISE WARNING 'Could not find organization for invitation to % (invited by %)', 
                     invitation_record.email, invitation_record.invited_by;
      END IF;
    END IF;
  END LOOP;
END $$;