create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  address text not null default '',
  ground_type text not null default '',
  capacity integer not null default 1 check (capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.venues
add column if not exists ground_type text not null default '';

alter table public.venues
add column if not exists capacity integer not null default 1 check (capacity > 0);

create unique index if not exists venues_name_address_unique_idx
on public.venues (lower(trim(name)), lower(trim(address)));

create table if not exists public.fields (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  label text not null default 'Main' check (char_length(trim(label)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists fields_venue_label_unique_idx
on public.fields (venue_id, lower(trim(label)));

create or replace function public.create_default_field_for_venue()
returns trigger
language plpgsql
as $$
begin
  insert into public.fields (venue_id, label)
  values (new.id, 'Main')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists create_default_field_for_venue on public.venues;

create trigger create_default_field_for_venue
after insert on public.venues
for each row
execute function public.create_default_field_for_venue();

create table if not exists public.venue_availability (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  venue_name text check (venue_name is null or char_length(trim(venue_name)) > 0),
  field_id uuid references public.fields (id),
  permit_date date not null,
  permit_start_time time not null,
  permit_end_time time not null,
  capacity integer not null default 1 check (capacity > 0),
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

-- Existing permits are intentionally discarded because they have no reliable
-- league association. New linked rows are preserved on subsequent executions.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'venue_availability'
      and column_name = 'league_id'
  ) then
    delete from public.venue_availability;
  end if;
end;
$$;

alter table public.venue_availability
add column if not exists league_id uuid references public.leagues (id) on delete cascade;

alter table public.venue_availability
alter column league_id set not null;

alter table public.venue_availability
alter column venue_name drop not null;

alter table public.venue_availability
add column if not exists field_id uuid references public.fields (id);

alter table public.venue_availability
add column if not exists capacity integer not null default 1 check (capacity > 0);

insert into public.venues (name, address)
select distinct trim(venue_name), ''
from public.venue_availability
where field_id is null
  and venue_name is not null
  and char_length(trim(venue_name)) > 0
on conflict do nothing;

insert into public.fields (venue_id, label)
select venues.id, 'Main'
from public.venues
where not exists (
  select 1
  from public.fields
  where fields.venue_id = venues.id
    and lower(trim(fields.label)) = lower('Main')
);

update public.venue_availability
set field_id = fields.id
from public.venues
join public.fields
  on fields.venue_id = venues.id
where venue_availability.field_id is null
  and venue_availability.venue_name is not null
  and lower(trim(venues.name)) = lower(trim(venue_availability.venue_name))
  and lower(trim(venues.address)) = lower('')
  and lower(trim(fields.label)) = lower('Main');

alter table public.venue_availability
alter column field_id set not null;

grant select, insert, update, delete
on table public.venues
to anon, authenticated;

grant select, insert, update, delete
on table public.fields
to anon, authenticated;

alter table public.venues enable row level security;
alter table public.fields enable row level security;

drop policy if exists "Anyone can view venues" on public.venues;
drop policy if exists "Anyone can add venues" on public.venues;
drop policy if exists "Anyone can edit venues" on public.venues;
drop policy if exists "Anyone can delete venues" on public.venues;
drop policy if exists "Anyone can view fields" on public.fields;
drop policy if exists "Anyone can add fields" on public.fields;
drop policy if exists "Anyone can edit fields" on public.fields;
drop policy if exists "Anyone can delete fields" on public.fields;

create policy "Anyone can view venues"
on public.venues
for select
to anon, authenticated
using (true);

create policy "Anyone can add venues"
on public.venues
for insert
to anon, authenticated
with check (true);

create policy "Anyone can edit venues"
on public.venues
for update
to anon, authenticated
using (true)
with check (true);

create policy "Anyone can delete venues"
on public.venues
for delete
to anon, authenticated
using (true);

create policy "Anyone can view fields"
on public.fields
for select
to anon, authenticated
using (true);

create policy "Anyone can add fields"
on public.fields
for insert
to anon, authenticated
with check (true);

create policy "Anyone can edit fields"
on public.fields
for update
to anon, authenticated
using (true)
with check (true);

create policy "Anyone can delete fields"
on public.fields
for delete
to anon, authenticated
using (true);

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

create index if not exists venue_availability_field_date_start_idx
on public.venue_availability (field_id, permit_date, permit_start_time);

create index if not exists venue_availability_league_date_start_idx
on public.venue_availability (league_id, permit_date, permit_start_time);

create index if not exists venue_availability_series_idx
on public.venue_availability (recurring_series_id);
