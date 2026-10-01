-- Applied to the shared DB by DELIVERY LEAD 380e54 on 1 Oct 2026 (Paul: "action it"),
-- recorded live as supabase_migrations version 20261001130338. Source-controlled copy, verbatim.
DO $$
DECLARE
  sig text;
  sigs text[] := ARRAY[
    'public.accept_organization_invitation(uuid,uuid)',
    'public.add_team_member(uuid,uuid,text,text)',
    'public.check_organisation_slug_exists(text)',
    'public.check_team_admin_access(uuid)',
    'public.check_team_admin(uuid)',
    'public.check_team_member_access(uuid)',
    'public.check_team_member_org()',
    'public.check_team_member(uuid)',
    'public.check_team_permission(uuid,text)',
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
    'public.remove_organization_member(uuid)',
    'public.remove_team_member(uuid)',
    'public.request_organization_access(text,text,text,text)',
    'public.resend_organisation_invitation(uuid)',
    'public.resend_team_invitation(uuid)',
    'public.track_invitation_status(uuid,text,jsonb)',
    'public.update_organization_member_role(uuid,text)',
    'public.update_team_member_role(uuid,text)'
  ];
BEGIN
  FOREACH sig IN ARRAY sigs LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', sig);
  END LOOP;
END $$;
