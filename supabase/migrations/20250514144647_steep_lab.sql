/*
  # Clean Team Members Migration
  
  1. Table Definition
    - Consolidates team_members table with all columns and constraints
    - Includes proper foreign key relationships and indexes
  
  2. Helper Functions
    - check_team_admin_access: Verifies if user has admin access to team
    - check_team_member_access: Verifies if user has member access to team
  
  3. Security
    - Enables RLS
    - Creates non-recursive policies for SELECT, INSERT, UPDATE, DELETE
    - Uses clear USING and WITH CHECK conditions
*/

-- Drop existing functions and policies
DROP FUNCTION IF EXISTS check_team_admin_access(team_uuid uuid);
DROP FUNCTION IF EXISTS check_team_member_access(team_uuid uuid);
DROP POLICY IF EXISTS team_members_delete ON team_members;
DROP POLICY IF EXISTS team_members_insert ON team_members;
DROP POLICY IF EXISTS team_members_select ON team_members;
DROP POLICY IF EXISTS team_members_update ON team_members;

-- Helper Functions
CREATE OR REPLACE FUNCTION check_team_admin_access(team_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM teams 
    WHERE id = team_uuid 
    AND (
      created_by = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_id = team_uuid 
        AND user_id = auth.uid() 
        AND role = 'admin'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_team_member_access(team_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = team_uuid
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create team_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  decision_role text CHECK (decision_role IN ('owner', 'approver', 'contributor', 'viewer')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_members_decision_role ON team_members(decision_role);

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'team_members_select'
  ) THEN
    CREATE POLICY "team_members_select" ON team_members
    FOR SELECT USING (
      user_id = auth.uid() OR
      check_team_admin_access(team_id) OR
      check_team_member_access(team_id)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'team_members_insert'
  ) THEN
    CREATE POLICY "team_members_insert" ON team_members
    FOR INSERT WITH CHECK (
      check_team_admin_access(team_id)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'team_members_update'
  ) THEN
    CREATE POLICY "team_members_update" ON team_members
    FOR UPDATE USING (
      check_team_admin_access(team_id)
    ) WITH CHECK (
      check_team_admin_access(team_id)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'team_members_delete'
  ) THEN
    CREATE POLICY "team_members_delete" ON team_members
    FOR DELETE USING (
      check_team_admin_access(team_id)
    );
  END IF;
END $$;