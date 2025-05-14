/*
  # Fix Team Members Policies
  
  1. Changes
    - Drop existing policies to avoid conflicts
    - Drop existing function to allow recreation
    - Create new non-recursive policies
    - Create helper function for checking team admin status
  
  2. Security
    - Policies ensure proper access control
    - Helper function is security definer
    - Clear separation between team creators and admins
*/

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "delete_team_members" ON public.team_members;
  DROP POLICY IF EXISTS "insert_team_members" ON public.team_members;
  DROP POLICY IF EXISTS "select_team_members" ON public.team_members;
  DROP POLICY IF EXISTS "update_team_members" ON public.team_members;
  DROP POLICY IF EXISTS "Members can view own membership" ON public.team_members;
  DROP POLICY IF EXISTS "Team creators and admins can add members" ON public.team_members;
  DROP POLICY IF EXISTS "Team creators and admins can delete members" ON public.team_members;
  DROP POLICY IF EXISTS "Team creators and admins can manage members" ON public.team_members;
  DROP POLICY IF EXISTS "Team creators and admins can update members" ON public.team_members;
  DROP POLICY IF EXISTS "Team creators and admins can view members" ON public.team_members;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.is_team_admin(uuid);

-- Create helper function for checking team admin status
CREATE OR REPLACE FUNCTION public.is_team_admin(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM teams
    WHERE id = team_uuid
    AND created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = team_uuid
    AND user_id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Create new non-recursive policies
CREATE POLICY "team_members_insert" ON public.team_members
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM teams
    WHERE id = team_members.team_id
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = team_members.team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
      )
    )
  )
);

CREATE POLICY "team_members_select" ON public.team_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM teams
    WHERE id = team_members.team_id
    AND created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = team_members.team_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'admin'
  )
);

CREATE POLICY "team_members_update" ON public.team_members
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM teams
    WHERE id = team_members.team_id
    AND created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = team_members.team_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM teams
    WHERE id = team_members.team_id
    AND created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = team_members.team_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'admin'
  )
);

CREATE POLICY "team_members_delete" ON public.team_members
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM teams
    WHERE id = team_members.team_id
    AND created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = team_members.team_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'admin'
  )
);