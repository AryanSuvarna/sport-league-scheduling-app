create table if not exists public.team_captain_invites (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  team_id uuid not null references public.league_teams (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists team_captain_invites_active_team_idx
  on public.team_captain_invites (team_id, expires_at)
  where revoked_at is null;

grant select, insert, update on public.team_captain_invites to authenticated;
revoke all on public.team_captain_invites from anon;

alter table public.team_captain_invites enable row level security;

drop policy if exists "Owners can manage team captain invites" on public.team_captain_invites;
create policy "Owners can manage team captain invites"
  on public.team_captain_invites for all to authenticated
  using ((select public.is_league_owner(league_id)))
  with check (
    (select public.is_league_owner(league_id))
    and exists (
      select 1 from public.league_teams
      where league_teams.id = team_captain_invites.team_id
        and league_teams.league_id = team_captain_invites.league_id
    )
  );

-- Captains submit through the token-validated server route. Owners retain
-- read access; raw anonymous inserts and reads are no longer permitted.
revoke all on public.team_availability_submissions from anon;
grant select on public.team_availability_submissions to authenticated;

drop policy if exists "Captains can submit team availability" on public.team_availability_submissions;
drop policy if exists "Anyone can view team availability" on public.team_availability_submissions;
drop policy if exists "Owners can view team availability" on public.team_availability_submissions;

create policy "Owners can view team availability"
  on public.team_availability_submissions for select to authenticated
  using (
    exists (
      select 1 from public.league_teams
      where league_teams.id = team_availability_submissions.team_id
        and (select public.is_league_owner(league_teams.league_id))
    )
  );
