-- Generated schedules are immutable runs. Regenerate instead of modifying fixture
-- rows so an administrator can compare outputs and retain scheduling history.
create table if not exists public.league_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  solver_status text not null check (solver_status in ('optimal', 'feasible')),
  schedule_status text not null default 'draft'
    check (schedule_status in ('draft', 'published', 'archived')),
  input_snapshot jsonb not null,
  objective_value numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.league_matches (
  id uuid primary key default gen_random_uuid(),
  schedule_run_id uuid not null references public.league_schedule_runs (id) on delete cascade,
  home_team_id uuid not null references public.league_teams (id) on delete restrict,
  away_team_id uuid not null references public.league_teams (id) on delete restrict,
  field_id uuid not null references public.fields (id) on delete restrict,
  venue_availability_id uuid references public.venue_availability (id) on delete set null,
  starts_at timestamp not null,
  ends_at timestamp not null,
  match_status text not null default 'scheduled'
    check (match_status in ('scheduled', 'confirmed', 'played', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint league_matches_different_teams check (home_team_id <> away_team_id),
  constraint league_matches_time_range check (ends_at > starts_at)
);

-- Keep this file safe to apply to databases that already have the original
-- scheduler tables without lifecycle columns.
alter table public.league_schedule_runs
  add column if not exists schedule_status text not null default 'draft';

alter table public.league_schedule_runs
  drop constraint if exists league_schedule_runs_schedule_status_check;

alter table public.league_schedule_runs
  add constraint league_schedule_runs_schedule_status_check
  check (schedule_status in ('draft', 'published', 'archived'));

alter table public.league_matches
  add column if not exists match_status text not null default 'scheduled';

alter table public.league_matches
  drop constraint if exists league_matches_match_status_check;

alter table public.league_matches
  add constraint league_matches_match_status_check
  check (match_status in ('scheduled', 'confirmed', 'played', 'cancelled'));

create index if not exists league_schedule_runs_league_created_at_idx
on public.league_schedule_runs (league_id, created_at desc);

create index if not exists league_matches_schedule_run_starts_at_idx
on public.league_matches (schedule_run_id, starts_at);

create unique index if not exists one_published_schedule_per_league_idx
on public.league_schedule_runs (league_id)
where schedule_status = 'published';

-- This matches the current app's public scheduling workflow. Tighten these policies
-- to ownership checks before enabling authenticated multi-tenant leagues.
grant select, insert, update on table public.league_schedule_runs to anon, authenticated;
grant select, insert, update on table public.league_matches to anon, authenticated;

alter table public.league_schedule_runs enable row level security;
alter table public.league_matches enable row level security;

drop policy if exists "Anyone can view league schedule runs" on public.league_schedule_runs;
drop policy if exists "Anyone can create league schedule runs" on public.league_schedule_runs;
drop policy if exists "Anyone can update league schedule runs" on public.league_schedule_runs;
drop policy if exists "Anyone can view league matches" on public.league_matches;
drop policy if exists "Anyone can create league matches" on public.league_matches;
drop policy if exists "Anyone can update league matches" on public.league_matches;

create policy "Anyone can view league schedule runs"
on public.league_schedule_runs for select to anon, authenticated using (true);

create policy "Anyone can create league schedule runs"
on public.league_schedule_runs for insert to anon, authenticated with check (true);

create policy "Anyone can update league schedule runs"
on public.league_schedule_runs for update to anon, authenticated
using (true) with check (true);

create policy "Anyone can view league matches"
on public.league_matches for select to anon, authenticated using (true);

create policy "Anyone can create league matches"
on public.league_matches for insert to anon, authenticated with check (true);

create policy "Anyone can update league matches"
on public.league_matches for update to anon, authenticated
using (true) with check (true);
