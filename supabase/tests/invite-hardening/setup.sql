-- PGlite stand-in for the live project, BEFORE state. Tables, keys and CHECK
-- constraints mirror the live catalogue (read 1 Oct 2026). Function bodies that
-- the migrations rewrite are in before.sql, copied from pg_proc.
create role anon nologin; create role authenticated nologin; create role service_role nologin;
do $$ begin execute format('grant temporary on database %I to authenticated', current_database()); end $$;  -- live default: TEMP is granted to PUBLIC
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create table auth.users(id uuid primary key, email text);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
create table user_profiles(id uuid primary key, email text, display_name text);
create table organisations(id uuid primary key, name text, owner_id uuid, slug text, plan_type text);
create table organisation_members(id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id), user_id uuid not null, role text not null default 'member', unique(organisation_id,user_id));
create table teams(id uuid primary key, name text not null, description text, created_by uuid not null, created_at timestamptz default now(), updated_at timestamptz default now(), organisation_id uuid references organisations(id));
create table team_members(id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id), user_id uuid not null, role text not null check (role in ('admin','member')), decision_role text check (decision_role in ('owner','approver','contributor','viewer')), joined_at timestamptz default now(), unique(team_id,user_id));
create table invitations(id uuid primary key, email text not null, invited_at timestamptz not null default now(), status text not null check (status in ('pending','accepted','expired')), invited_by uuid, team_id uuid references teams(id), role text, decision_role text, organisation_id uuid references organisations(id));
create table invitation_logs(id uuid primary key default gen_random_uuid(), invitation_id uuid, status text, details jsonb, created_at timestamptz);
create table canvases(id uuid primary key, user_id uuid, organisation_id uuid);
create table canvas_permissions(id uuid primary key default gen_random_uuid(), canvas_id uuid references canvases(id), user_id uuid references user_profiles(id), permission_type text not null check (permission_type in ('owner','editor','viewer','approver')), granted_by uuid, unique(canvas_id,user_id));
create table email_outbox(id serial primary key, to_addr text, subject text, data jsonb);
-- live helper bodies (search_path = public, unqualified)
create function check_team_admin(team_uuid uuid) returns boolean language plpgsql security definer set search_path=public as $$
BEGIN RETURN EXISTS (SELECT 1 FROM teams WHERE id = team_uuid AND created_by = auth.uid()) OR EXISTS (SELECT 1 FROM team_members WHERE team_id = team_uuid AND user_id = auth.uid() AND role = 'admin'); END; $$;
create function public.check_team_member_org() returns trigger language plpgsql as $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organisation_members om JOIN teams t ON t.organisation_id = om.organisation_id WHERE om.user_id = NEW.user_id AND t.id = NEW.team_id)
  THEN RAISE EXCEPTION 'User % is not a member of the organisation that owns team %', NEW.user_id, NEW.team_id; END IF;
  RETURN NEW;
END; $$;
create trigger team_member_org_enforce before insert or update on team_members for each row execute function public.check_team_member_org();
-- Transport mock ONLY (round 3). The email helper's real body is in before.sql;
-- these stand in for the pgsql-http extension, which Supabase installs in
-- `extensions` and whose role search_path is "$user", public, extensions.
create schema extensions;
create type extensions.http_method as enum ('GET','POST','PUT','PATCH','DELETE','HEAD');
create type extensions.http_header as (field varchar, value varchar);
create type extensions.http_request as (method extensions.http_method, uri varchar, headers extensions.http_header[], content_type varchar, content varchar);
create type extensions.http_response as (status integer, content_type varchar, headers extensions.http_header[], content varchar);
create function extensions.http_header(field varchar, value varchar) returns extensions.http_header language sql as $$ select row(field, value)::extensions.http_header $$;
create function extensions.http(request extensions.http_request) returns extensions.http_response language plpgsql as $$
DECLARE b jsonb := (request).content::jsonb;
BEGIN
  INSERT INTO public.email_outbox(to_addr, subject, data) VALUES (b->'to'->0->>'email', b->>'subject', b);
  RETURN row(200, 'application/json', null, '{"messageId":"m1"}')::extensions.http_response;
END; $$;
grant usage on schema extensions to anon, authenticated, service_role;
create table email_templates(name text primary key, html text, txt text, created_at timestamptz default now(), updated_at timestamptz default now());
insert into email_templates(name, html, txt) values ('team_invitation',
  '<p>{{inviter_name}} invited you to {{team_name}}</p><a href="{{accept_link}}">Accept</a>',
  '{{inviter_name}} invited you to {{team_name}}: {{accept_link}}');
set search_path = "$user", public, extensions;
set app.settings.brevo_api_key = 'test-key-not-a-secret';
create function can_create_organization(user_id_param uuid, plan_type_param text) returns boolean language sql security definer as $$ select true $$;
create function public.add_team_member(uuid,uuid,text,text) returns boolean language sql security definer as $$ select true $$;
create function public.check_organisation_slug_exists(text) returns boolean language sql security definer as $$ select true $$;
create function public.check_pending_invitations(text) returns boolean language sql security definer as $$ select true $$;
create function public.check_team_admin_access(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.check_team_member(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.check_team_member_access(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.check_team_permission(uuid,text) returns boolean language sql security definer as $$ select true $$;
create function public.check_team_size_limit(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.create_invite_link(uuid,integer) returns boolean language sql security definer as $$ select true $$;
create function public.get_invitation_status(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.get_organisation_details(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.get_organisation_invitations(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.get_organisation_members(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.get_organisation_teams(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.get_team_details(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.get_team_invitations(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.get_team_members(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.get_user_organisations() returns boolean language sql security definer as $$ select true $$;
create function public.get_user_teams() returns boolean language sql security definer as $$ select true $$;
create function public.has_collaborator_access(uuid,uuid) returns boolean language sql security definer as $$ select true $$;
create function public.has_team_permission(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.invite_user_to_organization_or_team(text,uuid,uuid,text,text) returns boolean language sql security definer as $$ select true $$;
create function public.is_team_admin(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.is_team_admin(uuid,uuid) returns boolean language sql security definer as $$ select true $$;
create function public.is_team_member(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.is_team_member(uuid,uuid) returns boolean language sql security definer as $$ select true $$;
create function public.manage_team_invitation(uuid,text,text) returns boolean language sql security definer as $$ select true $$;
create function public.manage_team_invite(uuid,text,text,text) returns boolean language sql security definer as $$ select true $$;
create function public.manage_team_invite(uuid,text,uuid,text) returns boolean language sql security definer as $$ select true $$;
create function public.manage_team_invite(uuid,text,uuid,text,text) returns boolean language sql security definer as $$ select true $$;
create function public.remove_organization_member(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.remove_team_member(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.request_organization_access(text,text,text,text) returns boolean language sql security definer as $$ select true $$;
create function public.resend_organisation_invitation(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.resend_team_invitation(uuid) returns boolean language sql security definer as $$ select true $$;
create function public.send_team_invitation_email(uuid,text,text,text,text,text) returns boolean language sql security definer as $$ select true $$;
create function public.test_email_sending(text) returns boolean language sql security definer as $$ select true $$;
create function public.update_organization_member_role(uuid,text) returns boolean language sql security definer as $$ select true $$;
create function public.update_team_member_role(uuid,text) returns boolean language sql security definer as $$ select true $$;
