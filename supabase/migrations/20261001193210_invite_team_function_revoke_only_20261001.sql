-- Invite / team function hardening, part (a): REVOKE-ONLY (ACCESS & INVITES, 1 Oct 2026).
--
-- Sections 1 and 3 of the reviewed 20261001140000 draft, copied VERBATIM
-- (DL 380e54 split ruling on DGAI #2402). Grants only: no CREATE OR REPLACE,
-- no function-body change, no table/row/policy change.
--   1. PUBLIC/anon EXECUTE revoked on 47 invite/team/org functions;
--      authenticated + service_role granted explicitly (all 47 had
--      authenticated EXECUTE before; section 3 narrows).
--   3. authenticated EXECUTE revoked on 11 functions with no caller in DGAI
--      staging, DGAI main, CEE or PLoT (email relays, membership oracles,
--      request_organization_access, the spoofable manage_team_invite overloads).
-- Kept production callers (TeamsContext get/add/track, email.ts 5-arg sender,
-- the send-team-invite Edge function) are NOT in section 3.
--
-- ORDERING HAZARD: never re-run 20261001130338 (containment) after this file;
-- its loop re-grants authenticated EXECUTE on the section-3 functions.
-- The function rewrites (old sections 2 + 4) are round 2, a separate file.

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

COMMIT;
