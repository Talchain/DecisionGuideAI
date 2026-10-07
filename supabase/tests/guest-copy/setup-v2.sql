-- PGlite stand-in for the live project, for copy_guest_scenario v2 (S-G slice 2, 7 Oct 2026). `scenarios` is
-- setup.sql's (read live 1 Oct 2026). `v5_conversation_turns` is DERIVED FROM CEE's migrations at CEE staging d738949c
-- (20260417160000 … 20261006230000: 20 columns, 5 CHECKs, the unique key, the scenario FK); it was not read from the
-- live project (this lane does not query production's database). The migration's PRE-CHECK lists the live columns for
-- the DL to compare before applying. Supabase's default ACL grants EXECUTE on every
-- new public function to anon, authenticated and service_role, so the same
-- default is set here: a migration that forgot its REVOKE would be callable.
create role anon nologin; create role authenticated nologin; create role service_role nologin;
do $$ begin execute format('grant temporary on database %I to anon, authenticated, service_role', current_database()); end $$;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif((coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb)->>'sub','')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table public.model_versions(id uuid primary key);
create table public.scenarios(
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  title text,
  scenario_schema_version integer not null default 1,
  stage text not null default 'frame' check (stage = any (array['frame','ideate','evaluate','decide','optimise'])),
  graph jsonb,
  framing jsonb,
  analysis_status text not null default 'none' check (analysis_status = any (array['none','running','ready','failed'])),
  analysis jsonb,
  analysis_error jsonb,
  analysis_provenance jsonb,
  events jsonb not null default '[]'::jsonb,
  event_seq integer not null default 0,
  brief jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_turn_nonce integer not null default 0,
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  source_scenario_id uuid references public.scenarios(id) on delete set null,
  latest_analysis_summary jsonb,
  brief_text text check (brief_text is null or (char_length(brief_text) between 1 and 8000 and brief_text ~ '[^[:space:]]')),
  current_model_version_id uuid references public.model_versions(id) on delete set null,
  rolling_summary jsonb,
  graph_identity_hash text,
  analysis_invalidated_at timestamptz
);
create function public.update_updated_at() returns trigger language plpgsql as $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
create trigger scenarios_updated_at before update on public.scenarios for each row execute function public.update_updated_at();
create table public.v5_conversation_turns(
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  user_id uuid,
  turn_id text not null,
  turn_class text not null,
  handler_id text,
  request_hash text not null,
  response_emitted boolean not null default true,
  llm_calls_used integer not null default 0,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now(),
  pending_actions jsonb not null default '[]'::jsonb,
  coaching_state jsonb,
  user_message text,
  assistant_message text,
  model_version_mutation_id uuid,
  model_version_created boolean,
  agent_guidance jsonb,
  suggested_actions jsonb,
  suggested_actions_run_key text,
  constraint v5_conversation_turns_scenario_turn_unique unique (scenario_id, turn_id),
  constraint v5_conversation_turns_turn_class_valid check (turn_class in ('direct_answer', 'clarify', 'handler', 'unhandled')),
  constraint v5_conversation_turns_handler_id_biconditional check ((turn_class = 'handler') = (handler_id is not null)),
  constraint v5_conversation_turns_pending_actions_shape check (jsonb_typeof(pending_actions) = 'array' and jsonb_array_length(pending_actions) <= 3),
  constraint v5_conversation_turns_coaching_state_shape check (coaching_state is null or jsonb_typeof(coaching_state) = 'object'),
  constraint v5_turn_model_version_marker_ck check ((model_version_mutation_id is null and model_version_created is null) or (model_version_mutation_id is not null and model_version_created is not null))
);
create table public.v5_handler_facts(id uuid primary key default gen_random_uuid(), scenario_id uuid not null, user_id uuid, v5_conversation_turn_id uuid not null references public.v5_conversation_turns(id) on delete cascade);
