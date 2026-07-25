create table if not exists public.venue_availability (
  id uuid primary key default gen_random_uuid(),
  ground_name text not null check (char_length(trim(ground_name)) > 0),
  permit_date date not null,
  permit_start_time time not null,
  permit_end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (permit_start_time < permit_end_time)
);

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
