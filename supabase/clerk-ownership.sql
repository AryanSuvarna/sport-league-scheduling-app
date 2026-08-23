-- Clerk is the authentication authority. In Supabase Dashboard enable the
-- Clerk third-party auth provider before applying these RLS policies.

create table if not exists public.profiles (
  clerk_user_id text primary key,
  email text,
  first_name text,
  last_name text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leagues
  add column if not exists owner_clerk_user_id text references public.profiles (clerk_user_id);

create index if not exists leagues_owner_clerk_user_id_created_at_idx
  on public.leagues (owner_clerk_user_id, created_at desc);

-- Migrate the earlier membership model when it exists. The first recorded
-- organizer becomes the single owner; review any multi-organizer leagues
-- before relying on this assignment.
do $$
begin
  if to_regclass('public.app_users') is not null then
    execute 'insert into public.profiles (clerk_user_id)
      select clerk_user_id from public.app_users
      on conflict (clerk_user_id) do nothing';
  end if;

  if to_regclass('public.league_organizers') is not null then
    execute 'with first_organizer as (
      select distinct on (league_id) league_id, clerk_user_id
      from public.league_organizers
      order by league_id, created_at asc
    )
    insert into public.profiles (clerk_user_id)
    select clerk_user_id from first_organizer
    on conflict (clerk_user_id) do nothing';

    execute 'with first_organizer as (
      select distinct on (league_id) league_id, clerk_user_id
      from public.league_organizers
      order by league_id, created_at asc
    )
    update public.leagues
    set owner_clerk_user_id = first_organizer.clerk_user_id
    from first_organizer
    where leagues.id = first_organizer.league_id
      and leagues.owner_clerk_user_id is null';
  end if;
end $$;

create or replace function public.is_league_owner(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leagues
    where id = target_league_id
      and owner_clerk_user_id = (select auth.jwt() ->> 'sub')
  );
$$;

revoke all on function public.is_league_owner(uuid) from public;
grant execute on function public.is_league_owner(uuid) to authenticated;

grant select, insert, update, delete on public.profiles, public.leagues, public.league_teams to authenticated;
revoke all on public.profiles, public.leagues, public.league_teams from anon;

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_teams enable row level security;

drop policy if exists "Anyone can view leagues" on public.leagues;
drop policy if exists "Anyone can add leagues" on public.leagues;
drop policy if exists "Anyone can edit leagues" on public.leagues;
drop policy if exists "Anyone can delete leagues" on public.leagues;
drop policy if exists "Owner can view leagues" on public.leagues;
drop policy if exists "Owner can create leagues" on public.leagues;
drop policy if exists "Owner can update leagues" on public.leagues;
drop policy if exists "Owner can delete leagues" on public.leagues;
drop policy if exists "Users can view their profile" on public.profiles;
drop policy if exists "Users can create their profile" on public.profiles;

create policy "Users can view their profile"
  on public.profiles for select to authenticated
  using (clerk_user_id = (select auth.jwt() ->> 'sub'));

create policy "Users can create their profile"
  on public.profiles for insert to authenticated
  with check (clerk_user_id = (select auth.jwt() ->> 'sub'));

create policy "Owner can view leagues"
  on public.leagues for select to authenticated
  using (owner_clerk_user_id = (select auth.jwt() ->> 'sub'));

create policy "Owner can create leagues"
  on public.leagues for insert to authenticated
  with check (owner_clerk_user_id = (select auth.jwt() ->> 'sub'));

create policy "Owner can update leagues"
  on public.leagues for update to authenticated
  using (owner_clerk_user_id = (select auth.jwt() ->> 'sub'))
  with check (owner_clerk_user_id = (select auth.jwt() ->> 'sub'));

create policy "Owner can delete leagues"
  on public.leagues for delete to authenticated
  using (owner_clerk_user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "Anyone can view league teams" on public.league_teams;
drop policy if exists "Anyone can add league teams" on public.league_teams;
drop policy if exists "Anyone can edit league teams" on public.league_teams;
drop policy if exists "Anyone can delete league teams" on public.league_teams;
drop policy if exists "Owner can view league teams" on public.league_teams;
drop policy if exists "Owner can create league teams" on public.league_teams;
drop policy if exists "Owner can update league teams" on public.league_teams;
drop policy if exists "Owner can delete league teams" on public.league_teams;

create policy "Owner can view league teams"
  on public.league_teams for select to authenticated
  using ((select public.is_league_owner(league_id)));

create policy "Owner can create league teams"
  on public.league_teams for insert to authenticated
  with check ((select public.is_league_owner(league_id)));

create policy "Owner can update league teams"
  on public.league_teams for update to authenticated
  using ((select public.is_league_owner(league_id)))
  with check ((select public.is_league_owner(league_id)));

create policy "Owner can delete league teams"
  on public.league_teams for delete to authenticated
  using ((select public.is_league_owner(league_id)));
