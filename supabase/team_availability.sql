-- Availability is submitted for a registered team. Records are retained as
-- submission history; the scheduler selects the most recent one per team.
create table if not exists public.team_availability_submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.league_teams (id) on delete cascade,
  available_start_date date,
  available_end_date date,
  available_dates date[] not null default '{}',
  has_day_preference boolean not null default false,
  preferred_days_of_week text[] not null default '{}',
  has_time_preference boolean not null default false,
  preferred_times_of_day text[] not null default '{}',
  blackout_dates date[] not null default '{}',
  recurring_blackouts jsonb not null default '[]'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_availability_required_availability_check
    check (
      (
        available_start_date is not null
        and available_end_date is not null
        and available_end_date >= available_start_date
      )
      or cardinality(available_dates) > 0
    ),
  constraint team_availability_preferred_days_values_check
    check (preferred_days_of_week <@ array['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']::text[]),
  constraint team_availability_day_preference_check
    check ((has_day_preference and cardinality(preferred_days_of_week) > 0) or (not has_day_preference and cardinality(preferred_days_of_week) = 0)),
  constraint team_availability_preferred_times_values_check
    check (preferred_times_of_day <@ array['Morning', 'Afternoon', 'Evening']::text[]),
  constraint team_availability_time_preference_check
    check ((has_time_preference and cardinality(preferred_times_of_day) > 0) or (not has_time_preference and cardinality(preferred_times_of_day) = 0))
);

-- Existing submissions cannot be safely associated with a team ID, so the
-- selected migration strategy is to clear the legacy shape exactly once.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_availability_submissions'
      and column_name = 'team_name'
  ) then
    delete from public.team_availability_submissions;
  end if;
end;
$$;

alter table public.team_availability_submissions
  add column if not exists team_id uuid references public.league_teams (id) on delete cascade;

alter table public.team_availability_submissions
  alter column team_id set not null;

alter table public.team_availability_submissions
  add column if not exists recurring_blackouts jsonb not null default '[]'::jsonb;

alter table public.team_availability_submissions
  drop column if exists team_name,
  drop column if exists captain_name,
  drop column if exists captain_email,
  drop column if exists season_start_date,
  drop column if exists season_end_date,
  drop column if exists preferred_dates;

alter table public.team_availability_submissions
  drop constraint if exists team_availability_season_range_check,
  drop constraint if exists team_availability_submissions_preferred_times_of_day_check,
  drop constraint if exists team_availability_submissions_preferred_times_of_day_check1,
  drop constraint if exists team_availability_submissions_preferred_dates_check;

grant select, insert on table public.team_availability_submissions to anon, authenticated;

alter table public.team_availability_submissions enable row level security;

drop policy if exists "Captains can submit team availability" on public.team_availability_submissions;
drop policy if exists "Anyone can view team availability" on public.team_availability_submissions;

create policy "Captains can submit team availability"
on public.team_availability_submissions for insert to anon, authenticated with check (true);

create policy "Anyone can view team availability"
on public.team_availability_submissions for select to anon, authenticated using (true);

drop index if exists public.team_availability_team_name_idx;
create index if not exists team_availability_team_created_at_idx
on public.team_availability_submissions (team_id, created_at desc);
