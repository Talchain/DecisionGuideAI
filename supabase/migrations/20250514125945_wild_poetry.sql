/*
  # Update Team Invite Email System
  
  1. Changes
    - Add pg_notify trigger to resendTeamInvitation function
    - Ensure proper notification payload for email sending
    
  2. Security
    - Maintain existing RLS policies
    - Use SECURITY DEFINER for functions
*/

-- Create or replace function to resend team invitations with notification
CREATE OR REPLACE FUNCTION public.resend_team_invitation(invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_team_name text;
  v_inviter_id uuid;
BEGIN
  -- Check if invitation exists and user has permission
  SELECT i.*, t.name as team_name
  INTO v_invitation
  FROM invitations i
  JOIN teams t ON i.team_id = t.id
  WHERE i.id = invitation_id
  AND (
    i.invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = i.team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  );
  
  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or not authorized';
  END IF;
  
  -- Update invitation timestamp
  UPDATE invitations
  SET invited_at = now(),
      status = 'pending'
  WHERE id = invitation_id
  RETURNING invited_by INTO v_inviter_id;
  
  -- Send notification for email sending
  PERFORM pg_notify(
    'send_invite', 
    json_build_object(
      'invitation_id', invitation_id,
      'email', v_invitation.email,
      'team_id', v_invitation.team_id,
      'team_name', v_invitation.team_name,
      'role', v_invitation.role,
      'decision_role', v_invitation.decision_role,
      'inviter_id', v_inviter_id
    )::text
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', invitation_id,
    'email', v_invitation.email
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.resend_team_invitation(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.resend_team_invitation IS 
'Resends a team invitation email by updating the timestamp and triggering a notification.
Sends a pg_notify event to trigger email sending via Edge Function.';

-- Create function to get user's name for email
CREATE OR REPLACE FUNCTION public.get_user_display_name(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_email text;
  v_display_name text;
BEGIN
  -- Get user profile info
  SELECT 
    up.first_name, 
    up.last_name,
    u.email
  INTO 
    v_first_name, 
    v_last_name,
    v_email
  FROM 
    user_profiles up
  JOIN 
    auth.users u ON up.id = u.id
  WHERE 
    up.id = user_id;
  
  -- Create display name
  IF v_first_name IS NOT NULL AND v_last_name IS NOT NULL THEN
    v_display_name := v_first_name || ' ' || v_last_name;
  ELSIF v_first_name IS NOT NULL THEN
    v_display_name := v_first_name;
  ELSIF v_last_name IS NOT NULL THEN
    v_display_name := v_last_name;
  ELSE
    v_display_name := v_email;
  END IF;
  
  RETURN v_display_name;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_display_name(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_user_display_name IS 
'Returns a user''s display name (first + last name) or email if name not available.
Used for email templates.';