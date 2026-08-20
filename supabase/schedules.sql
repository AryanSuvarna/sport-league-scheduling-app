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
  parent_schedule_run_id uuid references public.league_schedule_runs (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.league_matches (
  id uuid primary key default gen_random_uuid(),
  schedule_run_id uuid not null references public.league_schedule_runs (id) on delete cascade,
  home_team_id uuid not null references public.league_teams (id) on delete restrict,
  away_team_id uuid not null references public.league_teams (id) on delete restrict,
  field_id uuid references public.fields (id) on delete restrict,
  venue_availability_id uuid references public.venue_availability (id) on delete set null,
  parent_match_id uuid references public.league_matches (id) on delete set null,
  fixture_type text not null default 'regular'
    check (fixture_type in ('regular', 'makeup')),
  starts_at timestamp,
  ends_at timestamp,
  is_locked boolean not null default false,
  match_status text not null default 'scheduled'
    check (match_status in ('scheduled', 'confirmed', 'played', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint league_matches_different_teams check (home_team_id <> away_team_id),
  constraint league_matches_time_range check (
    (starts_at is null and ends_at is null and field_id is null)
    or (starts_at is not null and ends_at is not null and field_id is not null and ends_at > starts_at)
  )
);

create table if not exists public.league_schedule_edit_log (
  id uuid primary key default gen_random_uuid(),
  schedule_run_id uuid not null references public.league_schedule_runs (id) on delete cascade,
  match_id uuid not null references public.league_matches (id) on delete cascade,
  operation_type text not null check (operation_type in ('assignment_updated', 'lock_updated', 'status_updated')),
  before_state jsonb not null,
  after_state jsonb not null,
  is_undone boolean not null default false,
  created_at timestamptz not null default now()
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

alter table public.league_schedule_runs
  add column if not exists parent_schedule_run_id uuid references public.league_schedule_runs (id) on delete set null;

alter table public.league_matches
  add column if not exists is_locked boolean not null default false;

alter table public.league_matches
  add column if not exists parent_match_id uuid references public.league_matches (id) on delete set null;

alter table public.league_matches
  add column if not exists fixture_type text not null default 'regular';

alter table public.league_schedule_edit_log
  add column if not exists is_undone boolean not null default false;

alter table public.league_matches
  alter column field_id drop not null,
  alter column starts_at drop not null,
  alter column ends_at drop not null;

alter table public.league_matches
  drop constraint if exists league_matches_time_range;

alter table public.league_matches
  add constraint league_matches_time_range check (
    (starts_at is null and ends_at is null and field_id is null)
    or (starts_at is not null and ends_at is not null and field_id is not null and ends_at > starts_at)
  );

alter table public.league_matches
  drop constraint if exists league_matches_match_status_check;

alter table public.league_matches
  add constraint league_matches_match_status_check
  check (match_status in ('scheduled', 'confirmed', 'played', 'cancelled'));

alter table public.league_matches
  drop constraint if exists league_matches_fixture_type_check;

alter table public.league_matches
  add constraint league_matches_fixture_type_check
  check (fixture_type in ('regular', 'makeup'));

create index if not exists league_schedule_runs_league_created_at_idx
on public.league_schedule_runs (league_id, created_at desc);

create index if not exists league_matches_schedule_run_starts_at_idx
on public.league_matches (schedule_run_id, starts_at);

create index if not exists league_matches_schedule_run_field_starts_at_idx
on public.league_matches (schedule_run_id, field_id, starts_at)
where starts_at is not null;

create index if not exists league_matches_schedule_run_home_team_idx
on public.league_matches (schedule_run_id, home_team_id);

create index if not exists league_matches_schedule_run_away_team_idx
on public.league_matches (schedule_run_id, away_team_id);

create index if not exists league_matches_parent_match_idx
on public.league_matches (parent_match_id)
where parent_match_id is not null;

create index if not exists league_schedule_edit_log_run_created_at_idx
on public.league_schedule_edit_log (schedule_run_id, created_at desc);

create index if not exists league_schedule_edit_log_active_idx
on public.league_schedule_edit_log (schedule_run_id, created_at desc)
where not is_undone;

create unique index if not exists one_published_schedule_per_league_idx
on public.league_schedule_runs (league_id)
where schedule_status = 'published';

create or replace function public.publish_schedule_run(target_run_id uuid, target_league_id uuid)
returns public.league_schedule_runs
language plpgsql
security invoker
set search_path = public
as $$
declare
  published_run public.league_schedule_runs;
begin
  update public.league_schedule_runs
  set schedule_status = 'archived'
  where league_id = target_league_id
    and schedule_status = 'published';

  update public.league_schedule_runs
  set schedule_status = 'published'
  where id = target_run_id
    and league_id = target_league_id
    and schedule_status = 'draft'
  returning * into published_run;

  if not found then
    raise exception 'Only a draft schedule for this league can be published.';
  end if;

  return published_run;
end;
$$;

grant execute on function public.publish_schedule_run(uuid, uuid) to anon, authenticated;

-- This matches the current app's public scheduling workflow. Tighten these policies
-- to ownership checks before enabling authenticated multi-tenant leagues.
grant select, insert, update on table public.league_schedule_runs to anon, authenticated;
grant select, insert, update on table public.league_matches to anon, authenticated;
grant select, insert on table public.league_schedule_edit_log to anon, authenticated;
grant update on table public.league_schedule_edit_log to anon, authenticated;

alter table public.league_schedule_runs enable row level security;
alter table public.league_matches enable row level security;
alter table public.league_schedule_edit_log enable row level security;

drop policy if exists "Anyone can view league schedule runs" on public.league_schedule_runs;
drop policy if exists "Anyone can create league schedule runs" on public.league_schedule_runs;
drop policy if exists "Anyone can update league schedule runs" on public.league_schedule_runs;
drop policy if exists "Anyone can view league matches" on public.league_matches;
drop policy if exists "Anyone can create league matches" on public.league_matches;
drop policy if exists "Anyone can update league matches" on public.league_matches;
drop policy if exists "Anyone can view league schedule edit log" on public.league_schedule_edit_log;
drop policy if exists "Anyone can create league schedule edit log" on public.league_schedule_edit_log;
drop policy if exists "Anyone can update league schedule edit log" on public.league_schedule_edit_log;

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

create policy "Anyone can view league schedule edit log"
on public.league_schedule_edit_log for select to anon, authenticated using (true);

create policy "Anyone can create league schedule edit log"
on public.league_schedule_edit_log for insert to anon, authenticated with check (true);

create policy "Anyone can update league schedule edit log"
on public.league_schedule_edit_log for update to anon, authenticated
using (true) with check (true);
