/*
  # Team Invitations System
  
  1. New Tables
    - `invitations`: Stores pending team invitations
  
  2. New Functions
    - `manage_team_invite`: Handles inviting users to teams
    - `accept_team_invitation`: Allows users to accept invitations
    - `get_team_invitations`: Returns all invitations for a team
    - `get_my_invitations`: Returns all pending invitations for the current user
  
  3. Security
    - Enable RLS on invitations table
    - Add policies for team admins and invited users
*/

-- Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by uuid REFERENCES auth.users(id),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  UNIQUE(email, team_id)
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_at ON public.invitations(invited_at);
CREATE INDEX IF NOT EXISTS idx_invitations_team_id ON public.invitations(team_id);

-- Create function to manage team invitations
CREATE OR REPLACE FUNCTION public.manage_team_invite(
  team_uuid uuid,
  email_address text,
  member_role text DEFAULT 'member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  result jsonb;
BEGIN
  -- Validate input parameters
  IF team_uuid IS NULL THEN
    RAISE EXCEPTION 'team_uuid cannot be null';
  END IF;
  
  IF email_address IS NULL THEN
    RAISE EXCEPTION 'email_address cannot be null';
  END IF;

  IF member_role IS NULL THEN
    member_role := 'member';
  END IF;

  IF member_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid member_role. Must be either admin or member';
  END IF;

  -- Check if user has permission to manage team
  IF NOT check_team_admin(team_uuid) THEN
    RAISE EXCEPTION 'Not authorized to manage team members';
  END IF;

  -- Try to find existing user
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = email_address;

  -- If user exists, add them directly to the team
  IF target_user_id IS NOT NULL THEN
    -- Insert or update team member
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (team_uuid, target_user_id, member_role)
    ON CONFLICT (team_id, user_id) 
    DO UPDATE SET 
      role = EXCLUDED.role
    RETURNING jsonb_build_object(
      'id', id,
      'team_id', team_id,
      'user_id', user_id,
      'role', role,
      'joined_at', joined_at,
      'status', 'added'
    ) INTO result;
  ELSE
    -- User doesn't exist, create an invitation
    INSERT INTO public.invitations (
      team_id,
      email,
      role,
      status,
      invited_by
    )
    VALUES (
      team_uuid,
      email_address,
      member_role,
      'pending',
      auth.uid()
    )
    ON CONFLICT (email, team_id)
    DO UPDATE SET
      role = EXCLUDED.role,
      status = 'pending',
      invited_at = now(),
      invited_by = auth.uid()
    RETURNING jsonb_build_object(
      'id', id,
      'team_id', team_id,
      'email', email,
      'role', role,
      'invited_at', invited_at,
      'status', 'invited'
    ) INTO result;
    
    -- Here you would trigger an email notification
    -- This could be done via pg_notify to an Edge Function
    -- PERFORM pg_notify('send_invite', result::text);
  END IF;

  RETURN result;
END;
$$;

-- Create function to accept team invitation
CREATE OR REPLACE FUNCTION public.accept_team_invitation(
  invitation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
  user_id uuid;
  result jsonb;
BEGIN
  -- Get the current user ID
  user_id := auth.uid();
  
  -- Check if user is authenticated
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to accept invitation';
  END IF;
  
  -- Get invitation details
  SELECT * INTO inv
  FROM public.invitations
  WHERE id = invitation_id AND status = 'pending';
  
  -- Check if invitation exists
  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or already processed';
  END IF;
  
  -- Check if user's email matches invitation email
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = user_id AND email = inv.email
  ) THEN
    RAISE EXCEPTION 'This invitation is for a different email address';
  END IF;
  
  -- Add user to team
  INSERT INTO public.team_members (
    team_id,
    user_id,
    role
  )
  VALUES (
    inv.team_id,
    user_id,
    inv.role
  )
  ON CONFLICT (team_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role
  RETURNING jsonb_build_object(
    'id', id,
    'team_id', team_id,
    'user_id', user_id,
    'role', role,
    'joined_at', joined_at
  ) INTO result;
  
  -- Update invitation status
  UPDATE public.invitations
  SET status = 'accepted'
  WHERE id = invitation_id;
  
  RETURN result;
END;
$$;

-- Create function to get pending invitations for a team
CREATE OR REPLACE FUNCTION public.get_team_invitations(
  team_uuid uuid
)
RETURNS TABLE (
  id uuid,
  email text,
  invited_at timestamptz,
  status text,
  invited_by uuid,
  team_id uuid,
  role text,
  inviter_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has permission to view team invitations
  IF NOT check_team_admin(team_uuid) THEN
    RAISE EXCEPTION 'Not authorized to view team invitations';
  END IF;
  
  RETURN QUERY
  SELECT 
    i.id,
    i.email,
    i.invited_at,
    i.status,
    i.invited_by,
    i.team_id,
    i.role,
    u.email as inviter_email
  FROM public.invitations i
  LEFT JOIN auth.users u ON u.id = i.invited_by
  WHERE i.team_id = team_uuid
  ORDER BY i.invited_at DESC;
END;
$$;

-- Create function to get user's pending invitations
CREATE OR REPLACE FUNCTION public.get_my_invitations()
RETURNS TABLE (
  id uuid,
  email text,
  invited_at timestamptz,
  status text,
  invited_by uuid,
  team_id uuid,
  team_name text,
  role text,
  inviter_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Get current user's email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = auth.uid();
  
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  RETURN QUERY
  SELECT 
    i.id,
    i.email,
    i.invited_at,
    i.status,
    i.invited_by,
    i.team_id,
    t.name as team_name,
    i.role,
    u.email as inviter_email
  FROM public.invitations i
  JOIN teams t ON t.id = i.team_id
  LEFT JOIN auth.users u ON u.id = i.invited_by
  WHERE i.email = user_email
  AND i.status = 'pending'
  ORDER BY i.invited_at DESC;
END;
$$;

-- Create RLS policies for invitations
CREATE POLICY "Team admins can view invitations"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE id = invitations.team_id AND created_by = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = invitations.team_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Team admins can create invitations"
  ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE id = invitations.team_id AND created_by = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = invitations.team_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Team admins can update invitations"
  ON public.invitations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE id = invitations.team_id AND created_by = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = invitations.team_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Users can view their own invitations"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND email = invitations.email
    )
  );

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.manage_team_invite(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_invitations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_invitations() TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.manage_team_invite IS 
'Handles inviting users to teams. If the user exists, adds them directly to the team.
If not, creates a pending invitation.';

COMMENT ON FUNCTION public.accept_team_invitation IS
'Allows a user to accept a team invitation and join the team.';

COMMENT ON FUNCTION public.get_team_invitations IS
'Returns all invitations for a team. Only accessible to team admins.';

COMMENT ON FUNCTION public.get_my_invitations IS
'Returns all pending invitations for the current user.';