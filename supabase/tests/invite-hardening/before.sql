-- live originals (bodies as read from pg_proc 1 Oct), for the BEFORE state
CREATE FUNCTION public.get_teams_with_members(user_uuid uuid)
RETURNS TABLE(id uuid, name text, description text, created_by uuid, created_at timestamptz, updated_at timestamptz, members jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN QUERY SELECT t.id, t.name, t.description, t.created_by, t.created_at, t.updated_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', tm.id,'team_id', tm.team_id,'user_id', tm.user_id,'role', tm.role,'decision_role', tm.decision_role,'joined_at', tm.joined_at,'email', u.email))
      FROM team_members tm JOIN auth.users u ON u.id = tm.user_id WHERE tm.team_id = t.id), '[]'::jsonb) as members
  FROM teams t WHERE t.created_by = user_uuid OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.id AND tm.user_id = user_uuid);
END; $$;
CREATE FUNCTION public.track_invitation_status(invitation_uuid uuid, status_value text, details_json jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN INSERT INTO invitation_logs (invitation_id, status, details, created_at) VALUES (invitation_uuid, status_value, details_json, now()); END; $$;
CREATE FUNCTION public.send_team_invitation_email(invitation_uuid uuid, to_email text, team_name text, inviter_name text DEFAULT 'A team admin'::text, app_url text DEFAULT 'https://decisionguide.ai'::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB;
BEGIN
  IF invitation_uuid IS NULL OR to_email IS NULL OR team_name IS NULL THEN RETURN jsonb_build_object('success', false); END IF;
  PERFORM public.track_invitation_status(invitation_uuid,'sending','{}'::jsonb);
  v_result := public.send_email_with_template(to_email,'s','team_invitation','{}'::jsonb);
  RETURN v_result;
END; $$;
CREATE FUNCTION public.manage_team_member(team_uuid uuid, email_address text, member_role text, member_decision_role text)
RETURNS TABLE(id uuid, team_id uuid, user_id uuid, role text, decision_role text, joined_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE target_user_id UUID;
BEGIN
  IF member_role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'Invalid member_role'; END IF;
  SELECT id INTO target_user_id FROM auth.users WHERE email = email_address;
  RETURN QUERY INSERT INTO team_members (team_id, user_id, role, decision_role) VALUES (team_uuid, target_user_id, member_role, member_decision_role)
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role, decision_role = EXCLUDED.decision_role
  RETURNING team_members.id, team_members.team_id, team_members.user_id, team_members.role, team_members.decision_role, team_members.joined_at;
END; $$;
CREATE FUNCTION public.accept_organization_invitation(invitation_id_param uuid, user_id_param uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE invitation_record record; user_email text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = user_id_param;
  IF user_email IS NULL THEN RETURN jsonb_build_object('success', false); END IF;
  SELECT i.* INTO invitation_record FROM invitations i WHERE i.id = invitation_id_param AND i.status = 'pending' AND LOWER(i.email) = LOWER(user_email);
  IF invitation_record IS NULL THEN RETURN jsonb_build_object('success', false); END IF;
  INSERT INTO organisation_members (organisation_id, user_id, role) VALUES (invitation_record.organisation_id, user_id_param, COALESCE(invitation_record.role, 'member')) ON CONFLICT DO NOTHING;
  UPDATE invitations SET status = 'accepted' WHERE id = invitation_id_param;
  RETURN jsonb_build_object('success', true);
END; $$;
