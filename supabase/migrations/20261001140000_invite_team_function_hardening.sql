-- Invite / team function hardening (ACCESS & INVITES, 1 Oct 2026).
--
-- The live project (shared by staging and production) has SECURITY DEFINER
-- invite/team functions that are executable by anon and trust caller-supplied
-- user ids. This migration:
--   1. revokes PUBLIC/anon EXECUTE on the invite/team/org set (no logged-out
--      caller exists in DGAI staging, DGAI main, CEE or PLoT);
--   2. takes identity from auth.uid() in the functions that production's
--      TeamsContext still calls, so those callers keep working;
--   3. revokes authenticated EXECUTE on functions with no caller anywhere
--      that leak data, relay email or write without a permission check;
--   4. rewrites accept_organization_invitation to use auth.uid() and to
--      require that the inviter still holds owner/admin authority in the org.
--
-- Kept deliberately:
--   * can_access_organisation_resource: used by RLS policies for {public}.
--   * check_team_size_limit, can_create_organization: used by authenticated
--     RLS policies, so authenticated keeps EXECUTE (anon is revoked).
-- No table, row or RLS policy is changed. service_role keeps EXECUTE throughout.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. No logged-out caller: revoke PUBLIC + anon. Re-grant authenticated (all
--    had it; section 3 narrows) and service_role explicitly, so nothing that
--    reached them only via PUBLIC loses access.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.accept_organization_invitation(uuid,uuid)',
    'public.add_team_member(uuid,uuid,text,text)',
    'public.can_create_organization(uuid,text)',
    'public.check_organisation_slug_exists(text)',
    'public.check_pending_invitations(text)',
    'public.check_team_admin(uuid)',
    'public.check_team_admin_access(uuid)',
    'public.check_team_member(uuid)',
    'public.check_team_member_access(uuid)',
    'public.check_team_permission(uuid,text)',
    'public.check_team_size_limit(uuid)',
    'public.create_invite_link(uuid,integer)',
    'public.get_invitation_status(uuid)',
    'public.get_organisation_details(uuid)',
    'public.get_organisation_invitations(uuid)',
    'public.get_organisation_members(uuid)',
    'public.get_organisation_teams(uuid)',
    'public.get_team_details(uuid)',
    'public.get_team_invitations(uuid)',
    'public.get_team_members(uuid)',
    'public.get_teams_with_members(uuid)',
    'public.get_user_organisations()',
    'public.get_user_teams()',
    'public.has_collaborator_access(uuid,uuid)',
    'public.has_team_permission(uuid)',
    'public.invite_user_to_organization_or_team(text,uuid,uuid,text,text)',
    'public.is_team_admin(uuid)',
    'public.is_team_admin(uuid,uuid)',
    'public.is_team_member(uuid)',
    'public.is_team_member(uuid,uuid)',
    'public.manage_team_invitation(uuid,text,text)',
    'public.manage_team_invite(uuid,text,text,text)',
    'public.manage_team_invite(uuid,text,uuid,text)',
    'public.manage_team_invite(uuid,text,uuid,text,text)',
    'public.manage_team_member(uuid,text,text,text)',
    'public.remove_organization_member(uuid)',
    'public.remove_team_member(uuid)',
    'public.request_organization_access(text,text,text,text)',
    'public.resend_organisation_invitation(uuid)',
    'public.resend_team_invitation(uuid)',
    'public.send_email_with_template(text,text,text,jsonb)',
    'public.send_team_invitation_email(uuid,text,text,text,text)',
    'public.send_team_invitation_email(uuid,text,text,text,text,text)',
    'public.test_email_sending(text)',
    'public.track_invitation_status(uuid,text,jsonb)',
    'public.update_organization_member_role(uuid,text)',
    'public.update_team_member_role(uuid,text)'
  ]::regprocedure[]
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Still called by production's TeamsContext / email.ts: keep authenticated,
--    take identity from auth.uid().
-- ---------------------------------------------------------------------------

-- get_teams_with_members: only the caller's own teams.
CREATE OR REPLACE FUNCTION public.get_teams_with_members(user_uuid uuid)
RETURNS TABLE(id uuid, name text, description text, created_by uuid,
              created_at timestamp with time zone, updated_at timestamp with time zone,
              members jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR user_uuid IS DISTINCT FROM auth.uid() THEN
    RETURN;
  END IF;

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
    ) AS members
  FROM teams t
  WHERE t.created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = t.id
    AND tm.user_id = auth.uid()
  );
END;
$function$;

-- track_invitation_status: only the invitation's inviter (or service_role).
CREATE OR REPLACE FUNCTION public.track_invitation_status(
  invitation_uuid uuid, status_value text, details_json jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM invitations i
       WHERE i.id = invitation_uuid
       AND i.invited_by = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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
$function$;

-- send_team_invitation_email (5-arg, called by production email.ts): only the
-- inviter of a pending invitation, only to that invitation's address.
-- Body below the guard is unchanged.
CREATE OR REPLACE FUNCTION public.send_team_invitation_email(
  invitation_uuid uuid, to_email text, team_name text,
  inviter_name text DEFAULT 'A team admin'::text,
  app_url text DEFAULT 'https://decisionguide.ai'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM invitations i
       WHERE i.id = invitation_uuid
       AND i.invited_by = auth.uid()
       AND i.status = 'pending'
       AND LOWER(i.email) = LOWER(to_email)
     ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authorized'
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
$function$;

-- manage_team_member: restore the team-admin check the source migration
-- (20250513215400_proud_tower.sql) intended; the live body had none.
CREATE OR REPLACE FUNCTION public.manage_team_member(
  team_uuid uuid, email_address text, member_role text, member_decision_role text)
RETURNS TABLE(id uuid, team_id uuid, user_id uuid, role text, decision_role text,
              joined_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  target_user_id UUID;
BEGIN
  IF team_uuid IS NULL THEN
    RAISE EXCEPTION 'team_uuid cannot be null';
  END IF;

  IF NOT check_team_admin(team_uuid) THEN
    RAISE EXCEPTION 'Not authorized to manage team members';
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

  SELECT u.id INTO target_user_id
  FROM auth.users u
  WHERE u.email = email_address;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN QUERY
  INSERT INTO team_members AS tm (team_id, user_id, role, decision_role)
  VALUES (team_uuid, target_user_id, member_role, member_decision_role)
  ON CONFLICT (team_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    decision_role = EXCLUDED.decision_role
  RETURNING
    tm.id,
    tm.team_id,
    tm.user_id,
    tm.role,
    tm.decision_role,
    tm.joined_at;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. No caller anywhere (DGAI staging + main, CEE, PLoT) and unsafe for any
--    signed-in user: revoke authenticated too. service_role keeps EXECUTE.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION
  public.manage_team_invite(uuid,text,uuid,text),             -- anon-style upsert, spoofable inviter
  public.manage_team_invite(uuid,text,uuid,text,text),        -- same
  public.get_invitation_status(uuid),                          -- any invite's log
  public.check_pending_invitations(text),                      -- any email's invites
  public.request_organization_access(text,text,text,text),     -- email enumeration, writes for any user
  public.has_collaborator_access(uuid,uuid),                   -- membership oracle
  public.is_team_admin(uuid,uuid),                             -- membership oracle
  public.is_team_member(uuid,uuid),                            -- membership oracle
  public.send_email_with_template(text,text,text,jsonb),       -- email relay (callers are DEFINER)
  public.send_team_invitation_email(uuid,text,text,text,text,text), -- email relay, no caller
  public.test_email_sending(text)                              -- email relay
FROM authenticated;

-- ---------------------------------------------------------------------------
-- 4. accept_organization_invitation: identity from auth.uid(); the inviter
--    must still be the org owner or an owner/admin member. Signature kept;
--    user_id_param must be NULL or equal auth.uid().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_organization_invitation(
  invitation_id_param uuid, user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  invitation_record record;
  user_email text;
  org_membership_exists boolean := false;
  team_membership_exists boolean := false;
  result_message text;
  canvas_rec record;
  canvas_count integer := 0;
BEGIN
  IF v_uid IS NULL OR (user_id_param IS NOT NULL AND user_id_param <> v_uid) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User authentication failed. Please sign in again.'
    );
  END IF;

  SELECT email INTO user_email
  FROM auth.users
  WHERE id = v_uid;

  IF user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User authentication failed. Please sign in again.'
    );
  END IF;

  SELECT
    i.*,
    o.name AS org_name,
    t.name AS team_name
  INTO invitation_record
  FROM invitations i
  LEFT JOIN organisations o ON i.organisation_id = o.id
  LEFT JOIN teams t ON i.team_id = t.id
  WHERE i.id = invitation_id_param
    AND i.status = 'pending'
    AND LOWER(i.email) = LOWER(user_email);

  IF invitation_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This invitation is no longer valid or has already been used.'
    );
  END IF;

  -- The inviter must hold authority in the organisation the invite names.
  -- (Invitations INSERT RLS only checks invited_by = auth.uid().)
  IF NOT (
    EXISTS (
      SELECT 1 FROM organisations o
      WHERE o.id = invitation_record.organisation_id
      AND o.owner_id = invitation_record.invited_by
    )
    OR EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = invitation_record.organisation_id
      AND om.user_id = invitation_record.invited_by
      AND om.role IN ('owner', 'admin')
    )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This invitation is no longer valid or has already been used.'
    );
  END IF;

  IF invitation_record.invited_at < NOW() - INTERVAL '30 days' THEN
    UPDATE invitations
    SET status = 'expired'
    WHERE id = invitation_id_param;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'This invitation has expired. Please request a new invitation.'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = invitation_record.organisation_id
    AND user_id = v_uid
  ) INTO org_membership_exists;

  IF invitation_record.team_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = invitation_record.team_id
      AND user_id = v_uid
    ) INTO team_membership_exists;
  END IF;

  IF NOT org_membership_exists THEN
    INSERT INTO organisation_members (
      organisation_id,
      user_id,
      role
    ) VALUES (
      invitation_record.organisation_id,
      v_uid,
      COALESCE(invitation_record.role, 'member')
    );

    FOR canvas_rec IN
      SELECT id FROM canvases
      WHERE organisation_id = invitation_record.organisation_id
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM canvas_permissions
        WHERE canvas_id = canvas_rec.id AND user_id = v_uid
      ) AND NOT EXISTS (
        SELECT 1 FROM canvases
        WHERE id = canvas_rec.id AND user_id = v_uid
      ) THEN
        INSERT INTO canvas_permissions (canvas_id, user_id, permission_type, granted_by)
        VALUES (canvas_rec.id, v_uid, 'viewer', NULL)
        ON CONFLICT (canvas_id, user_id) DO NOTHING;

        canvas_count := canvas_count + 1;
      END IF;
    END LOOP;
  END IF;

  IF invitation_record.team_id IS NOT NULL AND NOT team_membership_exists THEN
    INSERT INTO team_members (
      team_id,
      user_id,
      role
    ) VALUES (
      invitation_record.team_id,
      v_uid,
      COALESCE(invitation_record.decision_role, 'member')
    );
  END IF;

  UPDATE invitations
  SET status = 'accepted'
  WHERE id = invitation_id_param;

  IF invitation_record.team_id IS NOT NULL THEN
    result_message := 'Successfully joined ' || invitation_record.org_name ||
                     ' and the ' || COALESCE(invitation_record.team_name, 'team');
  ELSE
    result_message := 'Successfully joined ' || invitation_record.org_name;
  END IF;

  IF canvas_count > 0 THEN
    result_message := result_message || '. You now have access to ' || canvas_count || ' canvas' ||
                     CASE WHEN canvas_count > 1 THEN 'es' ELSE '' END || '.';
  END IF;

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
$function$;

COMMIT;
