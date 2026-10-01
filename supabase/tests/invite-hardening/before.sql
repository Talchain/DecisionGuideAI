-- BEFORE state: the five rewritten functions EXACTLY as live, from
-- pg_get_functiondef on etmmuzwxtcjipwphdola (1 Oct 2026, after the
-- revoke-only migration; bodies unchanged since the start of the day).

CREATE OR REPLACE FUNCTION public.accept_organization_invitation(invitation_id_param uuid, user_id_param uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  invitation_record record;
  user_email text;
  org_membership_exists boolean := false;
  team_membership_exists boolean := false;
  result_message text;
  canvas_rec record;
  canvas_count integer := 0;
BEGIN
  -- Get the current user's email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id_param;

  IF user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User authentication failed. Please sign in again.'
    );
  END IF;

  -- Get the invitation details with organization and team info
  SELECT
    i.*,
    o.name as org_name,
    t.name as team_name
  INTO invitation_record
  FROM invitations i
  LEFT JOIN organisations o ON i.organisation_id = o.id
  LEFT JOIN teams t ON i.team_id = t.id
  WHERE i.id = invitation_id_param
    AND i.status = 'pending'
    AND LOWER(i.email) = LOWER(user_email);

  -- Check if invitation exists and is valid
  IF invitation_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This invitation is no longer valid or has already been used.'
    );
  END IF;

  -- Check if invitation has expired (optional: 30 days)
  IF invitation_record.invited_at < NOW() - INTERVAL '30 days' THEN
    -- Mark as expired
    UPDATE invitations
    SET status = 'expired'
    WHERE id = invitation_id_param;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'This invitation has expired. Please request a new invitation.'
    );
  END IF;

  -- Check existing organization membership
  SELECT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = invitation_record.organisation_id
    AND user_id = user_id_param
  ) INTO org_membership_exists;

  -- Check existing team membership (if team invitation)
  IF invitation_record.team_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = invitation_record.team_id
      AND user_id = user_id_param
    ) INTO team_membership_exists;
  END IF;

  -- Add to organization if not already a member
  IF NOT org_membership_exists THEN
    INSERT INTO organisation_members (
      organisation_id,
      user_id,
      role
    ) VALUES (
      invitation_record.organisation_id,
      user_id_param,
      COALESCE(invitation_record.role, 'member')
    );

    -- Grant viewer access to all existing canvases in the organization
    FOR canvas_rec IN
      SELECT id FROM canvases
      WHERE organisation_id = invitation_record.organisation_id
    LOOP
      -- Check if user already has any permission for this canvas or is the owner
      IF NOT EXISTS (
        SELECT 1 FROM canvas_permissions
        WHERE canvas_id = canvas_rec.id AND user_id = user_id_param
      ) AND NOT EXISTS (
        SELECT 1 FROM canvases
        WHERE id = canvas_rec.id AND user_id = user_id_param
      ) THEN
        INSERT INTO canvas_permissions (canvas_id, user_id, permission_type, granted_by)
        VALUES (canvas_rec.id, user_id_param, 'viewer', NULL)
        ON CONFLICT (canvas_id, user_id) DO NOTHING;

        canvas_count := canvas_count + 1;
      END IF;
    END LOOP;
  END IF;

  -- Add to team if team invitation and not already a member
  IF invitation_record.team_id IS NOT NULL AND NOT team_membership_exists THEN
    INSERT INTO team_members (
      team_id,
      user_id,
      role
    ) VALUES (
      invitation_record.team_id,
      user_id_param,
      COALESCE(invitation_record.decision_role, 'member')
    );
  END IF;

  -- Update invitation status to accepted
  UPDATE invitations
  SET status = 'accepted'
  WHERE id = invitation_id_param;

  -- Build success message
  IF invitation_record.team_id IS NOT NULL THEN
    result_message := 'Successfully joined ' || invitation_record.org_name ||
                     ' and the ' || COALESCE(invitation_record.team_name, 'team');
  ELSE
    result_message := 'Successfully joined ' || invitation_record.org_name;
  END IF;

  -- Add canvas access info to message
  IF canvas_count > 0 THEN
    result_message := result_message || '. You now have access to ' || canvas_count || ' canvas' ||
                     CASE WHEN canvas_count > 1 THEN 'es' ELSE '' END || '.';
  END IF;

  -- Handle cases where user was already a member
  IF org_membership_exists AND team_membership_exists THEN
    result_message := 'You are already a member of this organization and team';
  ELSIF org_membership_exists AND invitation_record.team_id IS NOT NULL THEN
    result_message := 'Added to ' || COALESCE(invitation_record.team_name, 'the team');
  ELSIF org_membership_exists THEN
    result_message := 'You are already a member of this organization';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', result_message,
    'organisation_name', invitation_record.org_name,
    'team_name', invitation_record.team_name,
    'org_role', COALESCE(invitation_record.role, 'member'),
    'team_role', invitation_record.decision_role,
    'canvas_access_granted', canvas_count
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Handle race conditions gracefully
    UPDATE invitations
    SET status = 'accepted'
    WHERE id = invitation_id_param;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Successfully joined the organization'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'An unexpected error occurred. Please try again or contact support.'
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_teams_with_members(user_uuid uuid)
 RETURNS TABLE(id uuid, name text, description text, created_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone, members jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.description,
    t.created_by,
    t.created_at,
    t.updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', tm.id,
            'team_id', tm.team_id,
            'user_id', tm.user_id,
            'role', tm.role,
            'decision_role', tm.decision_role,
            'joined_at', tm.joined_at,
            'email', u.email
          )
        )
        FROM team_members tm
        JOIN auth.users u ON u.id = tm.user_id
        WHERE tm.team_id = t.id
      ),
      '[]'::jsonb
    ) as members
  FROM teams t
  WHERE t.created_by = user_uuid
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = t.id
    AND tm.user_id = user_uuid
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.manage_team_member(team_uuid uuid, email_address text, member_role text, member_decision_role text)
 RETURNS TABLE(id uuid, team_id uuid, user_id uuid, role text, decision_role text, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  target_user_id UUID;
BEGIN
  -- Validate input parameters
  IF team_uuid IS NULL THEN
    RAISE EXCEPTION 'team_uuid cannot be null';
  END IF;

  IF email_address IS NULL THEN
    RAISE EXCEPTION 'email_address cannot be null';
  END IF;

  IF member_role IS NULL THEN
    RAISE EXCEPTION 'member_role cannot be null';
  END IF;

  IF member_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid member_role. Must be either admin or member';
  END IF;

  IF member_decision_role NOT IN ('owner', 'approver', 'contributor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid decision_role. Must be one of: owner, approver, contributor, viewer';
  END IF;

  -- Get user_id from auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = email_address;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', email_address;
  END IF;

  -- Insert or update team member
  RETURN QUERY
  INSERT INTO team_members (team_id, user_id, role, decision_role)
  VALUES (team_uuid, target_user_id, member_role, member_decision_role)
  ON CONFLICT (team_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    decision_role = EXCLUDED.decision_role
  RETURNING
    team_members.id,
    team_members.team_id,
    team_members.user_id,
    team_members.role,
    team_members.decision_role,
    team_members.joined_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_team_invitation_email(invitation_uuid uuid, to_email text, team_name text, inviter_name text DEFAULT 'A team admin'::text, app_url text DEFAULT 'https://decisionguide.ai'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSONB;
  v_accept_link TEXT;
BEGIN
  -- Validate inputs
  IF invitation_uuid IS NULL OR to_email IS NULL OR team_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing required parameters'
    );
  END IF;

  -- Create accept link
  v_accept_link := app_url || '/teams/join?token=' || invitation_uuid::text;

  -- Track invitation status
  PERFORM public.track_invitation_status(
    invitation_uuid,
    'sending',
    jsonb_build_object(
      'team_name', team_name,
      'inviter_name', inviter_name,
      'timestamp', now()::text
    )
  );

  -- Send invitation email
  v_result := public.send_email_with_template(
    to_email,
    'You''ve been invited to join ' || team_name || ' on DecisionGuide.AI',
    'team_invitation',
    jsonb_build_object(
      'team_name', team_name,
      'inviter_name', inviter_name,
      'accept_link', v_accept_link,
      'recipient_name', split_part(to_email, '@', 1)
    )
  );

  -- Track invitation status
  IF (v_result->>'success')::boolean THEN
    PERFORM public.track_invitation_status(
      invitation_uuid,
      'sent',
      jsonb_build_object(
        'message_id', v_result->>'message_id',
        'timestamp', now()::text
      )
    );
  ELSE
    PERFORM public.track_invitation_status(
      invitation_uuid,
      'failed',
      jsonb_build_object(
        'error', v_result->>'error',
        'timestamp', now()::text
      )
    );
  END IF;

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_invitation_status(invitation_uuid uuid, status_value text, details_json jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO invitation_logs (
    invitation_id,
    status,
    details,
    created_at
  ) VALUES (
    invitation_uuid,
    status_value,
    details_json,
    now()
  );
END;
$function$
;
