create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint leagues_name_required
    check (char_length(trim(name)) > 0),
  sport text not null constraint leagues_sport_required
    check (char_length(trim(sport)) > 0),
  season_start_date date not null,
  season_end_date date not null,
  match_duration_minutes integer not null default 120
    check (match_duration_minutes > 0),
  max_matches_per_team_per_week integer not null default 1
    check (max_matches_per_team_per_week > 0),
  match_rules text[] not null default '{}',
  scheduler_rules jsonb not null default '[]'::jsonb
    check (jsonb_typeof(scheduler_rules) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leagues_season_range_check
    check (season_end_date >= season_start_date)
);

alter table public.leagues
  add column if not exists scheduler_rules jsonb not null default '[]'::jsonb;

alter table public.leagues
  drop constraint if exists leagues_scheduler_rules_array;

alter table public.leagues
  add constraint leagues_scheduler_rules_array
  check (jsonb_typeof(scheduler_rules) = 'array');

-- Preserve every existing league's weekly match cap as its first typed rule.
update public.leagues
set scheduler_rules = jsonb_build_array(
  jsonb_build_object(
    'id', 'weekly-match-limit',
    'type', 'max_matches_per_team_per_week',
    'value', max_matches_per_team_per_week
  )
)
where scheduler_rules = '[]'::jsonb;

create table if not exists public.league_teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null constraint league_teams_name_required
    check (char_length(trim(name)) > 0),
  captain_name text not null constraint league_teams_captain_name_required
    check (char_length(trim(captain_name)) > 0),
  captain_phone text not null constraint league_teams_captain_phone_required
    check (char_length(trim(captain_phone)) > 0),
  captain_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint league_teams_captain_email_valid
    check (
      captain_email is null
      or captain_email = ''
      or position('@' in captain_email) > 1
    )
);

create index if not exists leagues_created_at_idx
on public.leagues (created_at desc);

create index if not exists league_teams_league_id_idx
on public.league_teams (league_id);

grant select, insert, update, delete
on table public.leagues
to anon, authenticated;

grant select, insert, update, delete
on table public.league_teams
to anon, authenticated;

alter table public.leagues enable row level security;
alter table public.league_teams enable row level security;

drop policy if exists "Anyone can view leagues" on public.leagues;
drop policy if exists "Anyone can add leagues" on public.leagues;
drop policy if exists "Anyone can edit leagues" on public.leagues;
drop policy if exists "Anyone can delete leagues" on public.leagues;
drop policy if exists "Anyone can view league teams" on public.league_teams;
drop policy if exists "Anyone can add league teams" on public.league_teams;
drop policy if exists "Anyone can edit league teams" on public.league_teams;
drop policy if exists "Anyone can delete league teams" on public.league_teams;

create policy "Anyone can view leagues"
on public.leagues
for select
to anon, authenticated
using (true);

create policy "Anyone can add leagues"
on public.leagues
for insert
to anon, authenticated
with check (true);

create policy "Anyone can edit leagues"
on public.leagues
for update
to anon, authenticated
using (true)
with check (true);

create policy "Anyone can delete leagues"
on public.leagues
for delete
to anon, authenticated
using (true);

create policy "Anyone can view league teams"
on public.league_teams
for select
to anon, authenticated
using (true);

create policy "Anyone can add league teams"
on public.league_teams
for insert
to anon, authenticated
with check (true);

create policy "Anyone can edit league teams"
on public.league_teams
for update
to anon, authenticated
using (true)
with check (true);

create policy "Anyone can delete league teams"
on public.league_teams
for delete
to anon, authenticated
using (true);
