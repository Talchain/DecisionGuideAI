/*
  # Fix Team Invitations Function and Schema
  
  1. Changes
    - Add team_id column to invitations table
    - Add role and decision_role columns to invitations table
    - Fix get_team_invitations function to properly query by team_id
    - Add manage_team_invite function for creating invitations
    - Add notification trigger for sending emails
  
  2. Security
    - Maintain existing RLS policies
    - Add proper permission checks
*/

-- Add missing columns to invitations table
ALTER TABLE public.invitations 
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id),
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS decision_role text DEFAULT 'contributor';

-- Create index for team_id
CREATE INDEX IF NOT EXISTS idx_invitations_team_id ON public.invitations(team_id);

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_team_invitations(uuid);

-- Create the function to get team invitations with proper column qualifiers
CREATE OR REPLACE FUNCTION public.get_team_invitations(team_uuid uuid)
RETURNS TABLE (
  id uuid,
  email text,
  invited_at timestamptz,
  status text,
  role text,
  decision_role text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user has permission to view team invitations
  IF NOT EXISTS (
    SELECT 1 FROM teams 
    WHERE teams.id = team_uuid 
    AND (
      teams.created_by = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_members.team_id = team_uuid 
        AND team_members.user_id = auth.uid() 
        AND team_members.role = 'admin'
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to view team invitations';
  END IF;

  -- Return pending invitations for the team
  RETURN QUERY
  SELECT 
    i.id,
    i.email,
    i.invited_at,
    i.status,
    i.role,
    i.decision_role
  FROM invitations i
  WHERE i.team_id = team_uuid
  AND i.status = 'pending'
  ORDER BY i.invited_at DESC;
END;
$$;

-- Create function to manage team invitations
CREATE OR REPLACE FUNCTION public.manage_team_invite(
  team_uuid uuid,
  email_address text,
  member_role text DEFAULT 'member',
  decision_role text DEFAULT 'contributor'
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_id uuid;
  result jsonb;
  team_name text;
BEGIN
  -- Check if user has permission to manage team
  IF NOT check_team_admin(team_uuid) THEN
    RAISE EXCEPTION 'Not authorized to manage team invitations';
  END IF;

  -- Get team name for notification
  SELECT name INTO team_name FROM teams WHERE id = team_uuid;
  
  -- Check if user already exists
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = email_address;

  -- If user exists, add directly to team
  IF target_user_id IS NOT NULL THEN
    -- Add user to team
    INSERT INTO team_members (team_id, user_id, role, decision_role)
    VALUES (team_uuid, target_user_id, member_role, decision_role)
    ON CONFLICT (team_id, user_id) 
    DO UPDATE SET 
      role = EXCLUDED.role,
      decision_role = EXCLUDED.decision_role
    RETURNING jsonb_build_object(
      'id', id,
      'team_id', team_id,
      'user_id', user_id,
      'role', role,
      'decision_role', decision_role,
      'joined_at', joined_at,
      'status', 'added'
    ) INTO result;
  ELSE
    -- Create invitation
    INSERT INTO invitations (
      email, 
      status, 
      invited_by, 
      team_id,
      role,
      decision_role
    )
    VALUES (
      email_address, 
      'pending', 
      auth.uid(), 
      team_uuid,
      member_role,
      decision_role
    )
    RETURNING jsonb_build_object(
      'id', id,
      'email', email,
      'invited_at', invited_at,
      'status', 'invited',
      'team_id', team_id,
      'role', role,
      'decision_role', decision_role
    ) INTO result;
    
    -- Notify for email sending
    PERFORM pg_notify(
      'send_invite', 
      json_build_object(
        'invitation_id', (result->>'id')::uuid,
        'email', email_address,
        'team_id', team_uuid,
        'team_name', team_name,
        'role', member_role,
        'decision_role', decision_role
      )::text
    );
  END IF;

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_team_invitations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_team_invite(uuid, text, text, text) TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.get_team_invitations IS 
'Returns pending invitations for a team. Only accessible to team admins.';

COMMENT ON FUNCTION public.manage_team_invite IS
'Creates a team invitation or adds a user directly if they already exist.
Triggers a notification for email sending via Edge Function.';