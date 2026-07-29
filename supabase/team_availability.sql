create table if not exists public.team_availability_submissions (
  id uuid primary key default gen_random_uuid(),
  team_name text not null constraint team_availability_team_name_required
    check (char_length(trim(team_name)) > 0),
  captain_name text not null constraint team_availability_captain_name_required
    check (char_length(trim(captain_name)) > 0),
  captain_email text not null constraint team_availability_captain_email_valid
    check (
      char_length(trim(captain_email)) > 3
      and position('@' in captain_email) > 1
    ),
  season_start_date date not null,
  season_end_date date not null,
  available_start_date date,
  available_end_date date,
  available_dates date[] not null default '{}',
  has_day_preference boolean not null default false,
  preferred_days_of_week text[] not null default '{}',
  has_time_preference boolean not null default false,
  preferred_times_of_day text[] not null default '{}',
  blackout_dates date[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_availability_season_range_check
    check (season_end_date >= season_start_date),
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
    check (
      preferred_days_of_week
      <@ array[
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday'
      ]::text[]
    ),
  constraint team_availability_day_preference_check
    check (
      (
        has_day_preference = true
        and cardinality(preferred_days_of_week) > 0
      )
      or (
        has_day_preference = false
        and cardinality(preferred_days_of_week) = 0
      )
    ),
  constraint team_availability_preferred_times_values_check
    check (
      preferred_times_of_day
      <@ array['Morning', 'Afternoon', 'Evening']::text[]
    ),
  constraint team_availability_time_preference_check
    check (
      (
        has_time_preference = true
        and cardinality(preferred_times_of_day) > 0
      )
      or (
        has_time_preference = false
        and cardinality(preferred_times_of_day) = 0
      )
    )
);

alter table public.team_availability_submissions
add column if not exists season_start_date date not null default '2026-05-01';

alter table public.team_availability_submissions
add column if not exists season_end_date date not null default '2026-09-30';

alter table public.team_availability_submissions
add column if not exists has_day_preference boolean not null default false;

alter table public.team_availability_submissions
add column if not exists preferred_days_of_week text[] not null default '{}';

alter table public.team_availability_submissions
add column if not exists has_time_preference boolean not null default false;

alter table public.team_availability_submissions
alter column preferred_times_of_day set default '{}';

alter table public.team_availability_submissions
drop column if exists preferred_dates;

alter table public.team_availability_submissions
drop constraint if exists team_availability_submissions_preferred_times_of_day_check;

alter table public.team_availability_submissions
drop constraint if exists team_availability_submissions_preferred_times_of_day_check1;

alter table public.team_availability_submissions
drop constraint if exists team_availability_submissions_preferred_dates_check;

update public.team_availability_submissions
set has_time_preference = cardinality(preferred_times_of_day) > 0;

update public.team_availability_submissions
set has_day_preference = cardinality(preferred_days_of_week) > 0;

alter table public.team_availability_submissions
drop constraint if exists team_availability_required_availability_check;

alter table public.team_availability_submissions
add constraint team_availability_required_availability_check
check (
  (
    available_start_date is not null
    and available_end_date is not null
    and available_end_date >= available_start_date
  )
  or cardinality(available_dates) > 0
);

alter table public.team_availability_submissions
drop constraint if exists team_availability_season_range_check;

alter table public.team_availability_submissions
add constraint team_availability_season_range_check
check (season_end_date >= season_start_date);

alter table public.team_availability_submissions
drop constraint if exists team_availability_preferred_days_values_check;

alter table public.team_availability_submissions
add constraint team_availability_preferred_days_values_check
check (
  preferred_days_of_week
  <@ array[
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ]::text[]
);

alter table public.team_availability_submissions
drop constraint if exists team_availability_day_preference_check;

alter table public.team_availability_submissions
add constraint team_availability_day_preference_check
check (
  (
    has_day_preference = true
    and cardinality(preferred_days_of_week) > 0
  )
  or (
    has_day_preference = false
    and cardinality(preferred_days_of_week) = 0
  )
);

alter table public.team_availability_submissions
drop constraint if exists team_availability_preferred_times_values_check;

alter table public.team_availability_submissions
add constraint team_availability_preferred_times_values_check
check (
  preferred_times_of_day
  <@ array['Morning', 'Afternoon', 'Evening']::text[]
);

alter table public.team_availability_submissions
drop constraint if exists team_availability_time_preference_check;

alter table public.team_availability_submissions
add constraint team_availability_time_preference_check
check (
  (
    has_time_preference = true
    and cardinality(preferred_times_of_day) > 0
  )
  or (
    has_time_preference = false
    and cardinality(preferred_times_of_day) = 0
  )
);

grant insert
on table public.team_availability_submissions
to anon, authenticated;

alter table public.team_availability_submissions enable row level security;

drop policy if exists "Captains can submit team availability"
on public.team_availability_submissions;

create policy "Captains can submit team availability"
on public.team_availability_submissions
for insert
to anon, authenticated
with check (true);

create index if not exists team_availability_team_name_idx
on public.team_availability_submissions (lower(trim(team_name)));

create index if not exists team_availability_created_at_idx
on public.team_availability_submissions (created_at desc);
