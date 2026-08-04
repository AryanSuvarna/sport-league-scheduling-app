-- Generated schedules are immutable runs. Regenerate instead of modifying fixture
-- rows so an administrator can compare outputs and retain scheduling history.
create table if not exists public.league_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  solver_status text not null check (solver_status in ('optimal', 'feasible')),
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
  created_at timestamptz not null default now(),
  constraint league_matches_different_teams check (home_team_id <> away_team_id),
  constraint league_matches_time_range check (ends_at > starts_at)
);

create index if not exists league_schedule_runs_league_created_at_idx
on public.league_schedule_runs (league_id, created_at desc);

create index if not exists league_matches_schedule_run_starts_at_idx
on public.league_matches (schedule_run_id, starts_at);

-- This matches the current app's public scheduling workflow. Tighten these policies
-- to ownership checks before enabling authenticated multi-tenant leagues.
grant select, insert on table public.league_schedule_runs to anon, authenticated;
grant select, insert on table public.league_matches to anon, authenticated;

alter table public.league_schedule_runs enable row level security;
alter table public.league_matches enable row level security;

drop policy if exists "Anyone can view league schedule runs" on public.league_schedule_runs;
drop policy if exists "Anyone can create league schedule runs" on public.league_schedule_runs;
drop policy if exists "Anyone can view league matches" on public.league_matches;
drop policy if exists "Anyone can create league matches" on public.league_matches;

create policy "Anyone can view league schedule runs"
on public.league_schedule_runs for select to anon, authenticated using (true);

create policy "Anyone can create league schedule runs"
on public.league_schedule_runs for insert to anon, authenticated with check (true);

create policy "Anyone can view league matches"
on public.league_matches for select to anon, authenticated using (true);

create policy "Anyone can create league matches"
on public.league_matches for insert to anon, authenticated with check (true);
