-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Create enum for board node types
create type node_type as enum ('decision', 'option', 'outcome');

-- Boards table
create table if not exists public.boards (
  id uuid not null default uuid_generate_v4(),
  title text not null default 'Untitled Board',
  version integer not null default 1,
  is_draft boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  
  constraint boards_pkey primary key (id)
);

-- Board versions (for history/versioning)
create table if not exists public.board_versions (
  id uuid not null default uuid_generate_v4(),
  board_id uuid not null references public.boards(id) on delete cascade,
  version integer not null,
  data jsonb not null,
  created_by uuid not null references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  
  constraint board_versions_pkey primary key (id),
  constraint board_versions_board_id_version_key unique (board_id, version)
);

-- Scenarios (snapshots of boards for analysis)
create table if not exists public.scenarios (
  id uuid not null default uuid_generate_v4(),
  board_id uuid not null references public.boards(id) on delete cascade,
  version integer not null,
  name text not null,
  description text,
  data jsonb not null,
  created_by uuid not null references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  
  constraint scenarios_pkey primary key (id),
  constraint scenarios_board_id_name_key unique (board_id, name)
);

-- Votes on options within scenarios
create table if not exists public.option_votes (
  id uuid not null default uuid_generate_v4(),
  option_id text not null,  -- References node ID in the board data
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote boolean not null,  -- true for upvote, false for downvote
  created_at timestamp with time zone not null default now(),
  
  constraint option_votes_pkey primary key (id),
  constraint option_votes_scenario_id_option_id_user_id_key unique (scenario_id, option_id, user_id)
);

-- Set up Row Level Security (RLS)
alter table public.boards enable row level security;
alter table public.board_versions enable row level security;
alter table public.scenarios enable row level security;
alter table public.option_votes enable row level security;

-- Policies for boards
create policy "Users can view their own boards"
on public.boards for select
using (auth.uid() = created_by);

create policy "Users can insert their own boards"
on public.boards for insert
with check (auth.uid() = created_by);

create policy "Users can update their own boards"
on public.boards for update
using (auth.uid() = created_by);

create policy "Users can delete their own boards"
on public.boards for delete
using (auth.uid() = created_by);

-- Policies for board_versions
create policy "Users can view versions of their boards"
on public.board_versions for select
using (exists (
  select 1 from public.boards 
  where boards.id = board_versions.board_id 
  and boards.created_by = auth.uid()
));

create policy "Users can insert versions for their boards"
on public.board_versions for insert
with check (exists (
  select 1 from public.boards 
  where boards.id = board_versions.board_id 
  and boards.created_by = auth.uid()
));

-- Similar policies for scenarios and option_votes following the same pattern...

-- Create indexes for performance
create index if not exists idx_boards_created_by on public.boards(created_by);
create index if not exists idx_board_versions_board_id on public.board_versions(board_id);
create index if not exists idx_scenarios_board_id on public.scenarios(board_id);
create index if not exists idx_option_votes_scenario_id on public.option_votes(scenario_id);
create index if not exists idx_option_votes_user_id on public.option_votes(user_id);

-- Set up updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger set_boards_updated_at
  before update on public.boards
  for each row execute procedure public.handle_updated_at();
