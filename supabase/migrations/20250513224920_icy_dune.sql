/*
  # Fix ambiguous decision_role reference in team invite function

  1. Changes
    - Update manage_team_invite function to explicitly reference decision_role from the correct table
    - Add explicit table references to avoid column ambiguity

  2. Security
    - No changes to RLS policies
    - Maintains existing security model
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS manage_team_invite;

-- Recreate the function with explicit table references
CREATE OR REPLACE FUNCTION manage_team_invite(
  p_team_id uuid,
  p_email text,
  p_role text,
  p_decision_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
  v_existing_member boolean;
  v_existing_invitation uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  -- Check if already a team member
  SELECT EXISTS (
    SELECT 1
    FROM team_members tm
    WHERE tm.team_id = p_team_id
    AND tm.user_id = v_user_id
  ) INTO v_existing_member;

  -- Check for existing invitation
  SELECT id INTO v_existing_invitation
  FROM invitations i
  WHERE i.team_id = p_team_id
  AND i.email = p_email
  AND i.status = 'pending';

  -- If user exists and not already a member, add them directly
  IF v_user_id IS NOT NULL AND NOT v_existing_member THEN
    INSERT INTO team_members (team_id, user_id, role, decision_role)
    VALUES (p_team_id, v_user_id, p_role, p_decision_role);
    
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
      p_team_id,
      p_email,
      p_role,
      p_decision_role,
      auth.uid(),
      'pending'
    )
    RETURNING id INTO v_existing_invitation;

    RETURN jsonb_build_object(
      'status', 'invited',
      'invitation_id', v_existing_invitation
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