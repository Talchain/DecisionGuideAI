/*
  # Fix Teams RLS and Policies

  1. Changes
    - Drop existing policies to avoid conflicts
    - Create new RLS policies for teams and team_members
    - Add helper functions for checking team membership and admin status
    - Add indexes for performance

  2. Security
    - Enable RLS on both tables
    - Ensure users can only:
      - Create teams (with themselves as admin)
      - View teams they are members of
      - Update/delete teams they are admins of
      - View members of their teams
      - Manage members if they are admins
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view teams they are members of" ON public.teams;
DROP POLICY IF EXISTS "Team admins can update their teams" ON public.teams;
DROP POLICY IF EXISTS "Users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Team admins can delete their teams" ON public.teams;
DROP POLICY IF EXISTS "Users can view team members for their teams" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can manage team members" ON public.team_members;

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Helper function: Check team membership
CREATE OR REPLACE FUNCTION public.is_team_member(
  _team_id uuid,
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = _team_id AND user_id = _user_id
  );
END;
$$;

-- Helper function: Check admin status
CREATE OR REPLACE FUNCTION public.is_team_admin(
  _team_id uuid,
  _user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = _team_id 
    AND user_id = _user_id 
    AND role = 'admin'
  );
END;
$$;

-- Teams Policies
CREATE POLICY "View teams as member"
  ON public.teams
  FOR SELECT
  USING (
    is_team_member(id, auth.uid())
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
    is_team_admin(id, auth.uid())
  )
  WITH CHECK (
    is_team_admin(id, auth.uid())
  );

CREATE POLICY "Delete as admin"
  ON public.teams
  FOR DELETE
  USING (
    is_team_admin(id, auth.uid())
  );

-- Team Members Policies
CREATE POLICY "View team members"
  ON public.team_members
  FOR SELECT
  USING (
    is_team_member(team_id, auth.uid())
  );

CREATE POLICY "Manage members as admin"
  ON public.team_members
  FOR ALL
  USING (
    is_team_admin(team_id, auth.uid())
  )
  WITH CHECK (
    is_team_admin(team_id, auth.uid())
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_members_team_user 
  ON public.team_members(team_id, user_id);