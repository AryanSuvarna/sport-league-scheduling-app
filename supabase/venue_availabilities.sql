create table if not exists public.venue_availability (
  id uuid primary key default gen_random_uuid(),
  venue_name text not null check (char_length(trim(venue_name)) > 0),
  permit_date date not null,
  permit_start_time time not null,
  permit_end_time time not null,
  entry_type text not null default 'single' check (entry_type in ('single', 'recurring')),
  recurring_series_id uuid,
  recurring_weekday smallint check (recurring_weekday between 0 and 6),
  series_start_date date,
  series_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (permit_start_time < permit_end_time),
  check (
    entry_type = 'single'
    or (
      recurring_series_id is not null
      and recurring_weekday is not null
      and series_start_date is not null
      and series_end_date is not null
      and series_end_date >= series_start_date
    )
  )
);

alter table public.venue_availability
add column if not exists entry_type text not null default 'single';

alter table public.venue_availability
add column if not exists recurring_series_id uuid;

alter table public.venue_availability
add column if not exists recurring_weekday smallint;

alter table public.venue_availability
add column if not exists series_start_date date;

alter table public.venue_availability
add column if not exists series_end_date date;

grant select, insert, update, delete
on table public.venue_availability
to anon, authenticated;

alter table public.venue_availability enable row level security;

drop policy if exists "Anyone can view venue availability" on public.venue_availability;
drop policy if exists "Anyone can add venue availability" on public.venue_availability;
drop policy if exists "Anyone can edit venue availability" on public.venue_availability;
drop policy if exists "Anyone can delete venue availability" on public.venue_availability;

create policy "Anyone can view venue availability"
on public.venue_availability
for select
to anon, authenticated
using (true);

create policy "Anyone can add venue availability"
on public.venue_availability
for insert
to anon, authenticated
with check (true);

create policy "Anyone can edit venue availability"
on public.venue_availability
for update
to anon, authenticated
using (true)
with check (true);

create policy "Anyone can delete venue availability"
on public.venue_availability
for delete
to anon, authenticated
using (true);

create index if not exists venue_availability_permit_date_start_idx
on public.venue_availability (permit_date, permit_start_time);

create index if not exists venue_availability_series_idx
on public.venue_availability (recurring_series_id);
