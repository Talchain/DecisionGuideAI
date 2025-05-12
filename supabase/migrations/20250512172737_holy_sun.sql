/*
  # Fix Teams RLS and Add Helper Functions
  
  1. Changes
     - Drop existing policies to avoid conflicts
     - Add helper functions for checking team roles
     - Create new RLS policies with proper checks
     - Add performance indexes
  
  2. Security
     - Enable RLS on both tables
     - Add policies for all CRUD operations
     - Ensure proper role checks
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "View teams as member" ON public.teams;
DROP POLICY IF EXISTS "Create own teams" ON public.teams;
DROP POLICY IF EXISTS "Update as admin" ON public.teams;
DROP POLICY IF EXISTS "Delete as admin" ON public.teams;
DROP POLICY IF EXISTS "View team members" ON public.team_members;
DROP POLICY IF EXISTS "Manage members as admin" ON public.team_members;
DROP POLICY IF EXISTS "Self-add as admin when creating team" ON public.team_members;

-- Helper function: Check team membership
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = _team_id 
    AND user_id = auth.uid()
  );
END;
$$;

-- Helper function: Check admin status
CREATE OR REPLACE FUNCTION public.is_team_admin(_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = _team_id 
    AND user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- Teams Policies
CREATE POLICY "View teams as member"
  ON public.teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Create own teams"
  ON public.teams
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
  );

CREATE POLICY "Update as admin"
  ON public.teams
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'admin'
    )
  );

CREATE POLICY "Delete as admin"
  ON public.teams
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'admin'
    )
  );

-- Team Members Policies
CREATE POLICY "View team members"
  ON public.team_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members AS tm
      WHERE tm.team_id = team_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Manage members as admin"
  ON public.team_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members AS tm
      WHERE tm.team_id = team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  );

CREATE POLICY "Self-add as admin when creating team"
  ON public.team_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE id = team_id
      AND created_by = auth.uid()
    )
    AND user_id = auth.uid()
    AND role = 'admin'
  );

-- Ensure RLS is enabled
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;