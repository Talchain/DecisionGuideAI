/*
  # Fix Team Policies Recursion

  1. Changes
    - Drop recursive policies that were causing infinite recursion
    - Add SECURITY DEFINER functions to safely check membership/admin status
    - Create new non-recursive policies using these functions
    - Add performance index
    
  2. Security
    - Functions use SECURITY DEFINER to bypass RLS
    - Policies use functions to avoid recursion
    - Maintains proper access control while fixing performance
*/

-- Drop old recursive policies
DROP POLICY IF EXISTS "Users can view team members for their teams" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can manage team members" ON public.team_members;

-- Helper: check membership without triggering RLS policies
CREATE OR REPLACE FUNCTION public.is_team_member(
  team_id uuid, 
  user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = $1 AND user_id = $2
  );
END;
$$;

-- Helper: check admin role without recursion
CREATE OR REPLACE FUNCTION public.is_team_admin(
  team_id uuid, 
  user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = $1 AND user_id = $2 AND role = 'admin'
  );
END;
$$;

-- New non-recursive policies
CREATE POLICY "View own memberships"
  ON public.team_members
  FOR SELECT
  USING ( is_team_member(team_id) );

CREATE POLICY "Admins can manage members"
  ON public.team_members
  FOR ALL
  USING ( is_team_admin(team_id) )
  WITH CHECK ( is_team_admin(team_id) );

-- Allow team creators to self-invite as admin
CREATE POLICY "Creator can add self as admin"
  ON public.team_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE id = team_id
        AND created_by = auth.uid()
    )
    AND user_id = auth.uid()
    AND role = 'admin'
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_team_members_team_user ON public.team_members(team_id, user_id);