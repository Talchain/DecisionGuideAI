/*
  # Fix Team Member Policies
  
  1. Changes
    - Drop old recursive policies that caused infinite recursion
    - Create helper functions with explicit type signatures
    - Add new non-recursive policies using helper functions
    - Add performance index
  
  2. Security
    - Helper functions use SECURITY DEFINER to bypass RLS
    - Policies ensure proper access control
    - Team creators can self-invite as admin
*/

-- Drop old recursive policies
DROP POLICY IF EXISTS "Users can view team members for their teams" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can manage team members" ON public.team_members;

-- Helper: check membership without triggering RLS policies
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

-- Helper: check admin role without recursion
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

-- New non-recursive policies
CREATE POLICY "View own memberships"
  ON public.team_members
  FOR SELECT
  USING (
    is_team_member(team_id, auth.uid())
  );

CREATE POLICY "Admins can manage members"
  ON public.team_members
  FOR ALL
  USING (
    is_team_admin(team_id, auth.uid())
  )
  WITH CHECK (
    is_team_admin(team_id, auth.uid())
  );

-- Allow team creators to self-invite as admin
CREATE POLICY "Creator can add self as admin"
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

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_team_members_team_user 
  ON public.team_members(team_id, user_id);