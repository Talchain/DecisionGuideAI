-- Invite / team function hardening, part (b): REWRITES (ACCESS & INVITES, round 2).
--
-- Grants were handled by 20261001193210 (revoke-only, applied). This file
-- changes function BODIES only; it grants and revokes nothing (CREATE OR
-- REPLACE keeps each function's ACL).
--
-- Answers the five P1s and the P2 of the #2402 CHANGES_REQUIRED review:
--   P1-1  accept: a named team must belong to the invitation's organisation,
--         and the inviter must still be that organisation's owner or an
--         owner/admin member (authority over the org's teams). A team invite
--         never grants an organisation role above 'member'.
--   P1-2  send_team_invitation_email: only the inviter, only for a pending
--         invitation to that exact address, only with the same scope authority;
--         team/org/inviter names come from stored rows, never from arguments;
--         the link origin is pinned (the app_url argument is ignored).
--   P1-3  every rewritten function, the helper check_team_admin and the
--         team_members trigger run with search_path = '' and fully qualified
--         relations, so a caller's temporary table cannot shadow an
--         authorisation lookup. send_email_with_template (only reachable from
--         SECURITY DEFINER callers) gets search_path = '' with its transport
--         schema-qualified (extensions.http / extensions.http_header).
--   Round 3 (P2s of the round-2 review): team invitations take their
--         organisation from the STORED team, because production's TeamsContext
--         writes them without organisation_id. A team's creator or team admin
--         also has authority over a team invitation, but only while a CURRENT
--         member of that organisation (teams RLS lets anyone create a team
--         claiming any organisation_id).
--   P1-4  team role and decision role go to their own columns and are
--         validated against team_members' CHECK constraints (role: admin |
--         member; decision_role: owner | approver | contributor | viewer).
--         Live invitations carry decision_role 'admin'/'editor', which are not
--         valid: 'editor' maps to 'contributor', anything else to NULL.
--   P1-5  accept: each insert handles its own conflict (ON CONFLICT DO
--         NOTHING); the invitation row is locked; the required memberships are
--         re-read before the invitation is marked accepted. There is no
--         catch-all that marks an invitation accepted after a rollback.
--
-- No table, row, policy or grant changes.

BEGIN;

-- ---------------------------------------------------------------------------
-- Helpers (P1-3)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_team_admin(team_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_uuid
    AND t.created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_uuid
    AND tm.user_id = auth.uid()
    AND tm.role = 'admin'
  );
END;
$function$;

-- Trigger on team_members (INSERT/UPDATE). Not SECURITY DEFINER, so it
-- inherits the caller's search_path; with search_path = '' in the callers
-- below its unqualified names would no longer resolve. Qualified and pinned.
CREATE OR REPLACE FUNCTION public.check_team_member_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  /* ensure the user is already a member of the same organisation */
  IF NOT EXISTS (
       SELECT 1
       FROM public.organisation_members om
       JOIN public.teams t ON t.organisation_id = om.organisation_id
       WHERE om.user_id = NEW.user_id
         AND t.id      = NEW.team_id)
  THEN
       RAISE EXCEPTION
         'User % is not a member of the organisation that owns team %',
         NEW.user_id, NEW.team_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Only reachable from SECURITY DEFINER callers since 20261001193210. Body is
-- the live one with its transport schema-qualified (round 3): under
-- search_path = '' the bare http()/http_header() calls would not resolve. The
-- pgsql-http extension lives in `extensions` on Supabase (it is not installed on
-- this project today, so the path is dormant either way).
CREATE OR REPLACE FUNCTION public.send_email_with_template(p_to text, p_subject text, p_template_name text, p_template_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_api_key TEXT;
  v_from_email TEXT;
  v_from_name TEXT;
  v_html_content TEXT;
  v_text_content TEXT;
  v_response JSONB;
  v_status INTEGER;
  v_error TEXT;
  v_template RECORD;
  v_key TEXT;
  v_value TEXT;
  v_keys_values RECORD;
BEGIN
  -- Get API key from environment
  v_api_key := current_setting('app.settings.brevo_api_key', true);
  IF v_api_key IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing email credentials: API key not configured'
    );
  END IF;

  -- Get from email
  v_from_email := current_setting('app.settings.from_email', true);
  IF v_from_email IS NULL THEN
    v_from_email := 'noreply@decisionguide.ai';
  END IF;

  v_from_name := 'DecisionGuide.AI';

  -- Get template content
  SELECT et.html, et.txt INTO v_template
  FROM public.email_templates et
  WHERE et.name = p_template_name;

  IF NOT FOUND THEN
    -- Use default template if not found
    v_html_content := '<html><body><h1>' || p_subject || '</h1><p>This is an automated email from DecisionGuide.AI.</p></body></html>';
    v_text_content := p_subject || '\n\nThis is an automated email from DecisionGuide.AI.';
  ELSE
    v_html_content := v_template.html;
    v_text_content := v_template.txt;

    -- Replace template variables
    IF p_template_data IS NOT NULL AND jsonb_typeof(p_template_data) = 'object' THEN
      FOR v_keys_values IN SELECT * FROM jsonb_each_text(p_template_data)
      LOOP
        v_key := v_keys_values.key;
        v_value := v_keys_values.value;
        v_html_content := replace(v_html_content, '{{' || v_key || '}}', v_value);
        v_text_content := replace(v_text_content, '{{' || v_key || '}}', v_value);
      END LOOP;
    END IF;
  END IF;

  -- Call Brevo API (transport schema-qualified)
  SELECT
    r.status,
    r.content::jsonb,
    CASE WHEN r.status >= 400 THEN r.content ELSE NULL END
  INTO
    v_status,
    v_response,
    v_error
  FROM
    extensions.http((
      'POST',
      'https://api.brevo.com/v3/smtp/email',
      ARRAY[
        extensions.http_header('api-key', v_api_key),
        extensions.http_header('Content-Type', 'application/json'),
        extensions.http_header('Accept', 'application/json')
      ],
      'application/json',
      jsonb_build_object(
        'sender', jsonb_build_object('email', v_from_email, 'name', v_from_name),
        'to', jsonb_build_array(jsonb_build_object('email', p_to)),
        'subject', p_subject,
        'htmlContent', v_html_content,
        'textContent', v_text_content
      )::text
    )::extensions.http_request) r;

  IF v_status >= 400 OR v_error IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_error, 'API error: ' || v_status::text),
      'status_code', v_status
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message_id', COALESCE((v_response->>'messageId')::text, 'unknown'),
    'response', v_response
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- get_teams_with_members: only the caller's own teams (P1-3 qualification)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_teams_with_members(user_uuid uuid)
RETURNS TABLE(id uuid, name text, description text, created_by uuid,
              created_at timestamp with time zone, updated_at timestamp with time zone,
              members jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
        FROM public.team_members tm
        JOIN auth.users u ON u.id = tm.user_id
        WHERE tm.team_id = t.id
      ),
      '[]'::jsonb
    ) AS members
  FROM public.teams t
  WHERE t.created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.team_members tm2
    WHERE tm2.team_id = t.id
    AND tm2.user_id = auth.uid()
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- track_invitation_status: only the invitation's inviter (or service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_invitation_status(
  invitation_uuid uuid, status_value text, details_json jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.invitations i
       WHERE i.id = invitation_uuid
       AND i.invited_by = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.invitation_logs (invitation_id, status, details, created_at)
  VALUES (invitation_uuid, status_value, details_json, now());
END;
$function$;

-- ---------------------------------------------------------------------------
-- manage_team_member: team admin only (the live body had no check)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manage_team_member(
  team_uuid uuid, email_address text, member_role text, member_decision_role text)
RETURNS TABLE(id uuid, team_id uuid, user_id uuid, role text, decision_role text,
              joined_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
#variable_conflict use_column
DECLARE
  target_user_id uuid;
BEGIN
  IF team_uuid IS NULL THEN
    RAISE EXCEPTION 'team_uuid cannot be null';
  END IF;

  IF NOT public.check_team_admin(team_uuid) THEN
    RAISE EXCEPTION 'Not authorized to manage team members';
  END IF;

  IF email_address IS NULL THEN
    RAISE EXCEPTION 'email_address cannot be null';
  END IF;

  IF member_role IS NULL OR member_role NOT IN ('admin', 'member') THEN
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
  INSERT INTO public.team_members AS tm (team_id, user_id, role, decision_role)
  VALUES (team_uuid, target_user_id, member_role, member_decision_role)
  ON CONFLICT (team_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    decision_role = EXCLUDED.decision_role
  RETURNING tm.id, tm.team_id, tm.user_id, tm.role, tm.decision_role, tm.joined_at;
END;
$function$;

-- ---------------------------------------------------------------------------
-- send_team_invitation_email (5-arg; production email.ts calls it)  P1-2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_team_invitation_email(
  invitation_uuid uuid, to_email text, team_name text,
  inviter_name text DEFAULT 'A team admin'::text,
  app_url text DEFAULT 'https://decisionguide.ai'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  -- Pinned origin: the app_url argument is ignored. This is the function's
  -- previous default, so production's link is unchanged.
  c_origin constant text := 'https://decisionguide.ai';
  inv record;
  v_is_service boolean := COALESCE(auth.jwt() ->> 'role', '') = 'service_role';
  v_org uuid;
  v_scope_name text;
  v_inviter_name text;
  v_accept_link text;
  v_result jsonb;
BEGIN
  IF invitation_uuid IS NULL OR to_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required parameters');
  END IF;

  SELECT i.* INTO inv
  FROM public.invitations i
  WHERE i.id = invitation_uuid
    AND i.status = 'pending'
    AND lower(i.email) = lower(to_email);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Only the inviter (or service_role), and only while the inviter holds
  -- authority over the invitation's scope (same predicate as acceptance).
  IF NOT v_is_service AND inv.invited_by IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Scope (round 3): a team invitation takes its organisation from the
  -- STORED team. Production's TeamsContext writes team invitations without
  -- organisation_id; when the row does carry one it must agree.
  IF inv.team_id IS NOT NULL THEN
    SELECT t.organisation_id INTO v_org FROM public.teams t WHERE t.id = inv.team_id;
    IF v_org IS NULL OR (inv.organisation_id IS NOT NULL AND inv.organisation_id <> v_org) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
  ELSE
    v_org := inv.organisation_id;
    IF v_org IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
  END IF;

  -- Authority over that scope: the organisation's owner or an owner/admin
  -- member; for a team invitation, also the team's creator or a team admin.
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organisations o
      WHERE o.id = v_org AND o.owner_id = inv.invited_by
    )
    OR EXISTS (
      SELECT 1 FROM public.organisation_members om
      WHERE om.organisation_id = v_org
        AND om.user_id = inv.invited_by
        AND om.role IN ('owner', 'admin')
    )
    OR (inv.team_id IS NOT NULL
      -- The teams INSERT policy checks only created_by, so anyone can create a
      -- team that CLAIMS any organisation. Team-level authority therefore
      -- also requires CURRENT membership of the stored team's organisation.
      AND EXISTS (
        SELECT 1 FROM public.organisation_members om2
        WHERE om2.organisation_id = v_org
          AND om2.user_id = inv.invited_by
      )
      AND (
      EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = inv.team_id AND t.created_by = inv.invited_by
      )
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = inv.team_id
          AND tm.user_id = inv.invited_by
          AND tm.role = 'admin'
      )
    ))
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Names from stored rows only; the team_name / inviter_name arguments are
  -- kept for signature compatibility and ignored.
  SELECT COALESCE(
           (SELECT t.name FROM public.teams t WHERE t.id = inv.team_id),
           (SELECT o.name FROM public.organisations o WHERE o.id = v_org)
         )
    INTO v_scope_name;
  SELECT COALESCE(NULLIF(btrim(up.display_name), ''), 'A team admin')
    INTO v_inviter_name
    FROM public.user_profiles up
    WHERE up.id = inv.invited_by;
  v_inviter_name := COALESCE(v_inviter_name, 'A team admin');

  v_accept_link := c_origin || '/teams/join?token=' || inv.id::text;

  PERFORM public.track_invitation_status(
    inv.id, 'sending',
    jsonb_build_object('team_name', v_scope_name, 'inviter_name', v_inviter_name, 'timestamp', now()::text)
  );

  v_result := public.send_email_with_template(
    inv.email,
    'You''ve been invited to join ' || v_scope_name || ' on DecisionGuide.AI',
    'team_invitation',
    jsonb_build_object(
      'team_name', v_scope_name,
      'inviter_name', v_inviter_name,
      'accept_link', v_accept_link,
      'recipient_name', split_part(inv.email, '@', 1)
    )
  );

  IF COALESCE((v_result ->> 'success')::boolean, false) THEN
    PERFORM public.track_invitation_status(
      inv.id, 'sent',
      jsonb_build_object('message_id', v_result ->> 'message_id', 'timestamp', now()::text)
    );
  ELSE
    PERFORM public.track_invitation_status(
      inv.id, 'failed',
      jsonb_build_object('error', v_result ->> 'error', 'timestamp', now()::text)
    );
  END IF;

  RETURN v_result;
END;
$function$;

-- ---------------------------------------------------------------------------
-- accept_organization_invitation  (P1-1, P1-3, P1-4, P1-5)
-- Signature kept; user_id_param must be NULL or equal to auth.uid().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_organization_invitation(
  invitation_id_param uuid, user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  inv record;
  v_org uuid;
  v_org_name text;
  v_team_name text;
  v_org_role text;
  v_team_role text;
  v_decision_role text;
  v_org_inserted boolean := false;
  v_team_inserted boolean := false;
  v_rows integer;
  canvas_count integer := 0;
  result_message text;
  c_invalid constant text := 'This invitation is no longer valid or has already been used.';
BEGIN
  IF v_uid IS NULL OR (user_id_param IS NOT NULL AND user_id_param <> v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User authentication failed. Please sign in again.');
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User authentication failed. Please sign in again.');
  END IF;

  -- Lock the invitation so two accepts cannot interleave.
  SELECT i.* INTO inv
  FROM public.invitations i
  WHERE i.id = invitation_id_param
    AND i.status = 'pending'
    AND lower(i.email) = lower(v_email)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', c_invalid);
  END IF;

  -- P1-1 + round 3:
  -- Scope (round 3): a team invitation takes its organisation from the
  -- STORED team. Production's TeamsContext writes team invitations without
  -- organisation_id; when the row does carry one it must agree.
  IF inv.team_id IS NOT NULL THEN
    SELECT t.organisation_id INTO v_org FROM public.teams t WHERE t.id = inv.team_id;
    IF v_org IS NULL OR (inv.organisation_id IS NOT NULL AND inv.organisation_id <> v_org) THEN
      RETURN jsonb_build_object('success', false, 'error', c_invalid);
    END IF;
  ELSE
    v_org := inv.organisation_id;
    IF v_org IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', c_invalid);
    END IF;
  END IF;

  -- Authority over that scope: the organisation's owner or an owner/admin
  -- member; for a team invitation, also the team's creator or a team admin.
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organisations o
      WHERE o.id = v_org AND o.owner_id = inv.invited_by
    )
    OR EXISTS (
      SELECT 1 FROM public.organisation_members om
      WHERE om.organisation_id = v_org
        AND om.user_id = inv.invited_by
        AND om.role IN ('owner', 'admin')
    )
    OR (inv.team_id IS NOT NULL
      -- The teams INSERT policy checks only created_by, so anyone can create a
      -- team that CLAIMS any organisation. Team-level authority therefore
      -- also requires CURRENT membership of the stored team's organisation.
      AND EXISTS (
        SELECT 1 FROM public.organisation_members om2
        WHERE om2.organisation_id = v_org
          AND om2.user_id = inv.invited_by
      )
      AND (
      EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = inv.team_id AND t.created_by = inv.invited_by
      )
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = inv.team_id
          AND tm.user_id = inv.invited_by
          AND tm.role = 'admin'
      )
    ))
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', c_invalid);
  END IF;

  IF inv.invited_at < now() - interval '30 days' THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired. Please request a new invitation.');
  END IF;

  SELECT o.name INTO v_org_name FROM public.organisations o WHERE o.id = v_org;
  IF inv.team_id IS NOT NULL THEN
    SELECT t.name INTO v_team_name FROM public.teams t WHERE t.id = inv.team_id;
  END IF;

  -- P1-4: each role in its own column, validated.
  IF inv.team_id IS NULL THEN
    v_org_role := CASE WHEN inv.role IN ('admin', 'member') THEN inv.role ELSE 'member' END;
  ELSE
    -- A team invitation never grants an organisation role above member.
    v_org_role := 'member';
    v_team_role := CASE WHEN inv.role IN ('admin', 'member') THEN inv.role ELSE 'member' END;
    v_decision_role := CASE
      WHEN inv.decision_role IN ('owner', 'approver', 'contributor', 'viewer') THEN inv.decision_role
      WHEN inv.decision_role = 'editor' THEN 'contributor'
      ELSE NULL
    END;
  END IF;

  -- P1-5: per-insert conflict handling.
  INSERT INTO public.organisation_members (organisation_id, user_id, role)
  VALUES (v_org, v_uid, v_org_role)
  ON CONFLICT (organisation_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_org_inserted := v_rows > 0;

  IF v_org_inserted THEN
    -- Viewer access to the organisation's existing canvases (unchanged intent).
    INSERT INTO public.canvas_permissions (canvas_id, user_id, permission_type, granted_by)
    SELECT c.id, v_uid, 'viewer', NULL
    FROM public.canvases c
    WHERE c.organisation_id = v_org
      AND c.user_id IS DISTINCT FROM v_uid
    ON CONFLICT (canvas_id, user_id) DO NOTHING;
    GET DIAGNOSTICS canvas_count = ROW_COUNT;
  END IF;

  IF inv.team_id IS NOT NULL THEN
    INSERT INTO public.team_members (team_id, user_id, role, decision_role)
    VALUES (inv.team_id, v_uid, v_team_role, v_decision_role)
    ON CONFLICT (team_id, user_id) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_team_inserted := v_rows > 0;
  END IF;

  -- Verify the required memberships exist before accepting.
  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.organisation_id = v_org AND om.user_id = v_uid
  ) OR (
    inv.team_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = inv.team_id AND tm.user_id = v_uid
    )
  ) THEN
    RAISE EXCEPTION 'membership not established';
  END IF;

  UPDATE public.invitations SET status = 'accepted' WHERE id = inv.id AND status = 'pending';

  IF inv.team_id IS NOT NULL THEN
    result_message := CASE
      WHEN NOT v_org_inserted AND NOT v_team_inserted THEN 'You are already a member of this organization and team'
      WHEN NOT v_org_inserted THEN 'Added to ' || COALESCE(v_team_name, 'the team')
      ELSE 'Successfully joined ' || COALESCE(v_org_name, 'the organization') || ' and the ' || COALESCE(v_team_name, 'team')
    END;
  ELSE
    result_message := CASE
      WHEN NOT v_org_inserted THEN 'You are already a member of this organization'
      ELSE 'Successfully joined ' || COALESCE(v_org_name, 'the organization')
    END;
  END IF;

  IF canvas_count > 0 THEN
    result_message := result_message || '. You now have access to ' || canvas_count || ' canvas' ||
                      CASE WHEN canvas_count > 1 THEN 'es' ELSE '' END || '.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', result_message,
    'organisation_name', v_org_name,
    'team_name', v_team_name,
    'org_role', v_org_role,
    'team_role', v_team_role,
    'decision_role', v_decision_role,
    'canvas_access_granted', canvas_count
  );

EXCEPTION
  WHEN OTHERS THEN
    -- The block's writes are rolled back and the invitation stays pending.
    RETURN jsonb_build_object(
      'success', false,
      'error', 'An unexpected error occurred. Please try again or contact support.'
    );
END;
$function$;

COMMIT;
