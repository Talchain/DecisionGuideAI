/*
  # Add pg_notify trigger to manage_team_invite function
  
  1. Changes
    - Update manage_team_invite function to send pg_notify event when creating invitations
    - This will trigger the Edge Function to send invitation emails
  
  2. Security
    - Maintains existing security context
    - No changes to permissions or RLS policies
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS manage_team_invite;

-- Recreate the function with pg_notify trigger
CREATE OR REPLACE FUNCTION manage_team_invite(
  team_uuid uuid,
  email_address text,
  member_role text DEFAULT 'member',
  decision_role text DEFAULT 'contributor'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
  v_existing_member boolean;
  v_existing_invitation uuid;
  v_team_name text;
  v_invitation_id uuid;
BEGIN
  -- Check if user has permission to manage team
  IF NOT check_team_admin(team_uuid) THEN
    RAISE EXCEPTION 'Not authorized to manage team invitations';
  END IF;

  -- Get team name for notification
  SELECT name INTO v_team_name FROM teams WHERE id = team_uuid;
  
  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = email_address;

  -- Check if already a team member
  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM team_members tm
      WHERE tm.team_id = team_uuid
      AND tm.user_id = v_user_id
    ) INTO v_existing_member;
  ELSE
    v_existing_member := false;
  END IF;

  -- Check for existing invitation
  SELECT id INTO v_existing_invitation
  FROM invitations i
  WHERE i.team_id = team_uuid
  AND i.email = email_address
  AND i.status = 'pending';

  -- If user exists and not already a member, add them directly
  IF v_user_id IS NOT NULL AND NOT v_existing_member THEN
    INSERT INTO team_members (team_id, user_id, role, decision_role)
    VALUES (team_uuid, v_user_id, member_role, decision_role);
    
    RETURN jsonb_build_object(
      'status', 'added',
      'user_id', v_user_id
    );
  
  -- If no existing invitation, create one
  ELSIF v_existing_invitation IS NULL THEN
    INSERT INTO invitations (
      team_id,
      email,
      role,
      decision_role,
      invited_by,
      status
    )
    VALUES (
      team_uuid,
      email_address,
      member_role,
      decision_role,
      auth.uid(),
      'pending'
    )
    RETURNING id INTO v_invitation_id;

    -- Send notification for email sending
    PERFORM pg_notify(
      'send_invite', 
      json_build_object(
        'invitation_id', v_invitation_id,
        'email', email_address,
        'team_id', team_uuid,
        'team_name', v_team_name,
        'role', member_role,
        'decision_role', decision_role
      )::text
    );

    RETURN jsonb_build_object(
      'status', 'invited',
      'invitation_id', v_invitation_id
    );
  
  -- Return existing invitation
  ELSE
    RETURN jsonb_build_object(
      'status', 'existing_invitation',
      'invitation_id', v_existing_invitation
    );
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION manage_team_invite(uuid, text, text, text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION manage_team_invite IS 
'Creates a team invitation or adds a user directly if they already exist.
Sends a pg_notify event to trigger email sending via Edge Function.
Parameters: team_uuid, email_address, member_role, decision_role.';