-- PGlite stand-in for the live project (read 2 Oct 2026). `scenarios` carries its live columns, CHECKs, self-FK,
-- trigger AND its four live RLS policies, so a member's direct reads/writes go through the real policy. Supabase's
-- default ACL (EXECUTE on new public functions for anon/authenticated/service_role) is mirrored, so a forgotten
-- REVOKE would show here.
create role anon nologin; create role authenticated nologin; create role service_role nologin;
do $$ begin execute format('grant temporary on database %I to anon, authenticated, service_role', current_database()); end $$;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif((coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb)->>'sub','')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table public.user_profiles(id uuid primary key, email text, display_name text);
create table public.model_versions(id uuid primary key);
create table public.scenarios(
  id uuid primary key default gen_random_uuid(), user_id uuid default auth.uid(), title text,
  scenario_schema_version integer not null default 1,
  stage text not null default 'frame' check (stage = any (array['frame','ideate','evaluate','decide','optimise'])),
  graph jsonb, framing jsonb,
  analysis_status text not null default 'none' check (analysis_status = any (array['none','running','ready','failed'])),
  analysis jsonb, analysis_error jsonb, analysis_provenance jsonb,
  events jsonb not null default '[]'::jsonb, event_seq integer not null default 0, brief jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  last_turn_nonce integer not null default 0, is_pinned boolean not null default false, is_archived boolean not null default false,
  source_scenario_id uuid references public.scenarios(id) on delete set null, latest_analysis_summary jsonb,
  brief_text text check (brief_text is null or (char_length(brief_text) between 1 and 8000 and brief_text ~ '[^[:space:]]')),
  current_model_version_id uuid references public.model_versions(id) on delete set null, rolling_summary jsonb,
  graph_identity_hash text, analysis_invalidated_at timestamptz
);
create function public.update_updated_at() returns trigger language plpgsql as $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
create trigger scenarios_updated_at before update on public.scenarios for each row execute function public.update_updated_at();
grant select, insert, update, delete on public.scenarios to authenticated;
alter table public.scenarios enable row level security;
create policy "Users can read own scenarios" on public.scenarios for select using (auth.uid() = user_id);
create policy "Users can insert own scenarios" on public.scenarios for insert with check (auth.uid() = user_id);
create policy "Users can update own scenarios" on public.scenarios for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own scenarios" on public.scenarios for delete using (auth.uid() = user_id);
-- shared_snapshots, as create_shared_snapshot writes it (columns read live).
create table public.shared_snapshots(id uuid primary key default gen_random_uuid(), scenario_id uuid references public.scenarios(id) on delete cascade,
  user_id uuid, graph jsonb, analysis jsonb, brief_text text, graph_hash text, seed bigint, slug text, created_at timestamptz default now(), expires_at timestamptz);
-- Transport stub ONLY: pgcrypto's gen_random_bytes, reached after create_shared_snapshot's ownership check.
create function public.gen_random_bytes(n integer) returns bytea language sql as $$ select decode(repeat('ab', n), 'hex') $$;
